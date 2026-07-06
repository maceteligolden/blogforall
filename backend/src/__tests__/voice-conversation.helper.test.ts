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

  it("detects out-of-scope voice commands", () => {
    expect(isOutOfScopeVoiceCommand("publish this post")).toBe(true);
    expect(isOutOfScopeVoiceCommand("schedule it for Monday")).toBe(true);
    expect(isDiscussIntent("let's discuss the topic")).toBe(true);
    expect(isResearchIntent("look online for trends")).toBe(true);
  });

  it("allows only base tools until draft-now", () => {
    expect(getVoiceAllowedToolNames("hello").has("search.web")).toBe(true);
    expect(getVoiceAllowedToolNames("hello").has("blogs.generateDraft")).toBe(false);
    expect(isVoiceToolAllowed("blogs.publish", "hello")).toBe(false);

    const allowed = getVoiceAllowedToolNames("go ahead and draft it now");
    expect(allowed.has("blogs.generateDraft")).toBe(true);
    expect(allowed.has("blogs.get")).toBe(true);
  });

  it("buildVoiceDeclineReply suggests text chat", () => {
    expect(buildVoiceDeclineReply()).toMatch(/voice call/i);
    expect(buildVoiceDeclineReply()).toMatch(/text chat/i);
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
