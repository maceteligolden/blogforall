import { describe, expect, it } from "@jest/globals";
import type { WorkspaceMemory } from "../shared/schemas/workspace-memory.schema";
import {
  buildVoiceDeclineReply,
  ensureVoiceConversationReply,
  getVoiceAllowedToolNames,
  isDiscussIntent,
  isExplicitDraftNowRequest,
  isOutOfScopeVoiceCommand,
  isResearchIntent,
  isVoiceToolAllowed,
  isWriteTopicRequest,
} from "../modules/orchestrator/utils/voice-conversation.helper";

const emptyMemory = {
  strategic: {
    target_audience: [],
    business_goals: [],
    seo_priorities: [],
    publishing_channels: [],
  },
  preferences: {},
} as unknown as WorkspaceMemory;

describe("voice-conversation.helper", () => {
  it("detects explicit draft-now requests", () => {
    expect(isExplicitDraftNowRequest("write it now")).toBe(true);
    expect(isExplicitDraftNowRequest("create the draft")).toBe(true);
    expect(isWriteTopicRequest("write a blog post about remote work")).toBe(true);
    expect(isExplicitDraftNowRequest("write a blog post about remote work")).toBe(false);
  });

  it("voice has full parity — never out of scope; intent helpers still work", () => {
    expect(isOutOfScopeVoiceCommand("publish this post")).toBe(false);
    expect(isOutOfScopeVoiceCommand("schedule it for Monday")).toBe(false);
    expect(isDiscussIntent("let's discuss the topic")).toBe(true);
    expect(isResearchIntent("look online for trends")).toBe(true);
  });

  it("allows all tools (no voice allowlist)", () => {
    expect(getVoiceAllowedToolNames("hello").size).toBe(0);
    expect(isVoiceToolAllowed("blogs.publish", "hello")).toBe(true);
    expect(isVoiceToolAllowed("blogs.generateDraft", "go ahead and draft it now")).toBe(true);
  });

  it("buildVoiceDeclineReply is a no-op parity stub (never tells user to switch to text)", () => {
    expect(buildVoiceDeclineReply()).not.toMatch(/text chat/i);
    expect(buildVoiceDeclineReply()).toMatch(/handle that/i);
  });

  it("ensureVoiceConversationReply strips markdown and adds a question", () => {
    const result = ensureVoiceConversationReply("Got it.", { memory: emptyMemory });
    expect(result.repaired).toBe(true);
    expect(result.reply).toContain("?");
  });

  it("caps long replies for speech", () => {
    const long = "A".repeat(400);
    const result = ensureVoiceConversationReply(long, { memory: emptyMemory });
    expect(result.reply.length).toBeLessThanOrEqual(321);
  });
});
