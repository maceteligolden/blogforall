import { describe, expect, it } from "@jest/globals";
import { SessionModeRouterService } from "../modules/orchestrator/services/session-mode-router.service";
import { ensureCasualConversationReply } from "../modules/orchestrator/utils/casual-conversation.helper";
import type { WorkspaceMemory } from "../shared/schemas/workspace-memory.schema";

const router = new SessionModeRouterService();

const emptyMemory = {
  strategic: {
    target_audience: [],
    business_goals: [],
    seo_priorities: [],
    publishing_channels: [],
  },
  preferences: {},
} as unknown as WorkspaceMemory;

describe("SessionModeRouterService", () => {
  it("detects explicit switch to writing", () => {
    const result = router.resolve({
      clientMode: "auto",
      userMessage: "switch to writing mode",
    });
    expect(result.effectiveMode).toBe("writing");
    expect(result.source).toBe("explicit");
    expect(result.clientModeOverride).toBe("writing");
  });

  it("detects explicit switch back to auto", () => {
    const result = router.resolve({
      clientMode: "writing",
      userMessage: "go back to auto mode",
    });
    expect(result.clientModeOverride).toBe("auto");
    expect(result.source).toBe("explicit");
  });

  it("respects manual lock when no explicit switch", () => {
    const result = router.resolve({
      clientMode: "research",
      userMessage: "tell me about my audience",
    });
    expect(result.effectiveMode).toBe("research");
    expect(result.source).toBe("manual");
  });

  it("infers writing from draft intent in auto mode", () => {
    const result = router.resolve({
      clientMode: "auto",
      userMessage: "help me draft a blog about remote work",
    });
    expect(result.effectiveMode).toBe("writing");
    expect(result.source).toBe("inferred");
  });

  it("defaults casual for short chat in auto mode", () => {
    const result = router.resolve({
      clientMode: "auto",
      userMessage: "hey, how are you?",
    });
    expect(result.effectiveMode).toBe("casual");
    expect(result.source).toBe("inferred");
  });

  it("uses writing mode for selection context only when user asks to edit the draft", () => {
    const edit = router.resolve({
      clientMode: "auto",
      userMessage: "rewrite this to be punchier",
      hasSelectionContext: true,
    });
    expect(edit.effectiveMode).toBe("writing");

    const discuss = router.resolve({
      clientMode: "auto",
      userMessage: "what does this mean?",
      hasSelectionContext: true,
    });
    expect(discuss.effectiveMode).toBe("casual");
  });
});

describe("ensureCasualConversationReply", () => {
  it("appends follow-up when reply is short and not a question", () => {
    const result = ensureCasualConversationReply("Sounds good.", emptyMemory);
    expect(result.repaired).toBe(true);
    expect(result.reply).toContain("?");
  });

  it("does not repair when reply already ends with a question", () => {
    const result = ensureCasualConversationReply("What audience are you targeting?", emptyMemory);
    expect(result.repaired).toBe(false);
  });
});
