import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { ConversationIntelligenceService } from "../../../../modules/orchestrator/ai/conversation-intelligence/conversation-intelligence";
import { MemoryManagerService } from "../../../../modules/orchestrator/ai/memory/manager/memory-manager";
import { ResearchLiteService } from "../../../../modules/orchestrator/ai/skills/research/research-lite.service";
import {
  assertWritingMayProceed,
  writingToolAllowlist,
} from "../../../../modules/orchestrator/ai/skills/writing/writing-guards";
import { MVP_LOCKS } from "../../../../modules/orchestrator/ai/contracts/mvp-locks";

const baseCiInput = {
  workspace_id: "ws_1",
  user_id: "u_1",
  thread_id: "th_1",
};

describe("T2.1 ConversationIntelligenceService", () => {
  const ci = new ConversationIntelligenceService();

  it("A1 soft create → create_content with topic", async () => {
    const ctx = await ci.analyze({
      ...baseCiInput,
      message: "We should probably write a post about remote onboarding.",
    });
    expect(ctx.workflow_intent).toBe("create_content");
    expect(ctx.suggested_next_action).toBe("start_content_workflow");
    expect(ctx.slots_patch.topic).toMatch(/remote onboarding/i);
    expect(ctx.action_required).toBe(true);
  });

  it("A2 brainstorm → planning / start_planning", async () => {
    const ctx = await ci.analyze({
      ...baseCiInput,
      message: "I want to brainstorm blog ideas for Q3.",
    });
    expect(ctx.communicative_category).toBe("brainstorm");
    expect(ctx.suggested_next_action).toBe("start_planning");
  });

  it("A3 casual greeting → casual_reply", async () => {
    const ctx = await ci.analyze({ ...baseCiInput, message: "Hey!" });
    expect(ctx.communicative_category).toBe("casual");
    expect(ctx.suggested_next_action).toBe("casual_reply");
  });

  it("A4 preference update → emit_memory_candidate", async () => {
    const ctx = await ci.analyze({
      ...baseCiInput,
      message: "From now on I prefer a more conversational tone.",
    });
    expect(ctx.suggested_next_action).toBe("emit_memory_candidate");
    expect(ctx.workflow_intent).toBe("update_memory");
  });

  it("A5 feedback with open draft → revise", async () => {
    const ctx = await ci.analyze({
      ...baseCiInput,
      message: "This feels too robotic and boring.",
      open_artifacts: { draft_id: "d1" },
    });
    expect(ctx.suggested_next_action).toBe("revise_current_artifact");
    expect(ctx.communicative_category).toBe("provide_feedback");
  });

  it("A6 create without topic → clarify", async () => {
    const ctx = await ci.analyze({
      ...baseCiInput,
      message: "Write a blog post.",
    });
    expect(ctx.requires_clarification).toBe(true);
    expect(ctx.suggested_next_action).toBe("clarify");
  });

  it("A7 research request", async () => {
    const ctx = await ci.analyze({
      ...baseCiInput,
      message: "Can you research competitors in the CRM space?",
    });
    expect(ctx.workflow_intent).toBe("research");
  });

  it("A8 urgency shortens response style", async () => {
    const ctx = await ci.analyze({
      ...baseCiInput,
      message: "Write a blog about AI agents — need it for a client presentation tomorrow.",
    });
    expect(ctx.urgency).toBe("high");
    expect(ctx.response_style.brevity).toBe("short");
  });
});

describe("T2.2 MemoryManagerService", () => {
  let packs: { build: jest.Mock; toPromptBlock: jest.Mock };
  let extraction: { processTurn: jest.Mock };
  let workspaceMemory: { findBySiteId: jest.Mock; ensureForSite: jest.Mock };
  let memoryRecords: { listByLayer: jest.Mock; upsert: jest.Mock };
  let mm: MemoryManagerService;

  beforeEach(() => {
    packs = {
      build: jest.fn(async () => ({
        structured: "s",
        behavioral: "",
        episodic: "ep",
        semantic: "",
        knowledge: "",
        calendar: "",
      })),
      toPromptBlock: jest.fn(() => "PROMPT"),
    };
    extraction = { processTurn: jest.fn(async () => undefined) };
    workspaceMemory = {
      findBySiteId: jest.fn(async () => null),
      ensureForSite: jest.fn(async () => ({
        site_id: "ws_1",
        strategic: {
          business_description: "A workspace for founders",
          brand_voice: "clear",
          target_audience: ["founders"],
          business_goals: ["growth"],
          seo_priorities: [],
          publishing_channels: ["blog"],
        },
        preferences: { tone: "friendly" },
      })),
    };
    memoryRecords = {
      listByLayer: jest.fn(async () => []),
      upsert: jest.fn(async (r: unknown) => r),
    };
    mm = new MemoryManagerService(
      packs as any,
      extraction as any,
      workspaceMemory as any,
      memoryRecords as any,
      { findById: jest.fn(async () => null) } as any
    );
  });

  it("retrieve builds pack with chat_light → planning and includeVectors false", async () => {
    const result = await mm.retrieve({
      workspace_id: "ws_1",
      profile: "chat_light",
      user_message: "hi",
    });
    expect(packs.build).toHaveBeenCalledWith(
      expect.objectContaining({
        siteId: "ws_1",
        sessionMode: "planning",
        includeVectors: false,
      })
    );
    expect(result.prompt_block).toBe("PROMPT");
    expect(result.workspace_slice?.brand_voice).toBe("clear");
    expect(result.session_summary).toBe("ep");
  });

  it("rememberAsync returns job_id without awaiting extraction", async () => {
    const { job_id } = await mm.rememberAsync({
      turn_id: "t1",
      workspace_id: "ws_1",
      user_id: "u1",
      text: "I prefer short posts",
      source: "user_utterance",
      proposed_layer: "user_preference",
    });
    expect(job_id).toBeTruthy();
    await new Promise((r) => setImmediate(r));
    expect(extraction.processTurn).toHaveBeenCalled();
  });

  it("remember discard skips extraction", async () => {
    await mm.remember({
      turn_id: "t1",
      workspace_id: "ws_1",
      user_id: "u1",
      source: "user_utterance",
      proposed_layer: "discard",
    });
    expect(extraction.processTurn).not.toHaveBeenCalled();
    expect(memoryRecords.upsert).not.toHaveBeenCalled();
  });

  it("remember with proposed_key upserts memory_records", async () => {
    const result = await mm.remember({
      turn_id: "t1",
      workspace_id: "ws_1",
      user_id: "u1",
      text: "prefer short",
      source: "user_utterance",
      proposed_layer: "user_preference",
      proposed_key: "tone.brevity",
      proposed_value: "short",
      confidence: 0.9,
    });
    expect(result.status).toBe("stored");
    expect(memoryRecords.upsert).toHaveBeenCalled();
    expect(extraction.processTurn).toHaveBeenCalled();
  });
});

describe("T2.3 ResearchLiteService + Writing guards", () => {
  it("builds ResearchPackage from Tavily notes and caps sources", async () => {
    const notes = Array.from({ length: 8 }, (_, i) => ({
      url: `https://example.com/${i}`,
      title: `Title ${i}`,
      snippet: `Snippet about topic ${i}`,
    }));
    const tavily = { search: jest.fn(async () => notes) };
    const artifacts = { saveResearchPackage: jest.fn(async () => ({ package_id: "rp_x" })) };
    const research = new ResearchLiteService(tavily as any, artifacts as any);
    const result = await research.run({
      workspace_id: "ws_1",
      topic: "AI agents",
      persist: false,
    });
    expect(result.package.depth).toBe("lite");
    expect(result.package.sources).toHaveLength(MVP_LOCKS.researchSourcesLiteMax);
    expect(result.provenance_errors).toEqual([]);
    expect(result.summary.source_count).toBe(MVP_LOCKS.researchSourcesLiteMax);
    expect(result.package.degraded).toBeFalsy();
    expect(artifacts.saveResearchPackage).not.toHaveBeenCalled();
  });

  it("marks degraded when search returns empty", async () => {
    const tavily = { search: jest.fn(async () => []) };
    const artifacts = { saveResearchPackage: jest.fn(async () => ({ package_id: "rp_x" })) };
    const research = new ResearchLiteService(tavily as any, artifacts as any);
    const result = await research.run({ workspace_id: "ws_1", topic: "obscure", persist: false });
    expect(result.package.degraded).toBe(true);
    expect(result.package.sources).toHaveLength(0);
  });

  it("Writing requires research_package_id", () => {
    expect(() => assertWritingMayProceed({})).toThrow(/research_package_id/);
    expect(() => assertWritingMayProceed({ research_package_id: "rp_1" })).not.toThrow();
  });

  it("Writing allowlist strips search tools", () => {
    expect(writingToolAllowlist(["blog.save", "search.web", "tavily.search"])).toEqual(["blog.save"]);
  });
});
