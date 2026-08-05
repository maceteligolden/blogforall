import { describe, expect, it } from "@jest/globals";
import {
  countQuestionMarks,
  ensureOnboardingInterviewReply,
  formatOnboardingProgress,
  onboardingReplyNeedsFollowUp,
} from "../../../modules/orchestrator/utils/onboarding-interview.helper";
import type { WorkspaceMemory } from "../../../shared/schemas/workspace-memory.schema";

function emptyMemory(): WorkspaceMemory {
  return {
    strategic: {},
    preferences: {},
  } as WorkspaceMemory;
}

function memoryWithBusinessType(): WorkspaceMemory {
  return {
    strategic: { business_type: "B2B SaaS analytics" },
    preferences: {},
  } as WorkspaceMemory;
}

describe("onboarding interview one-field-at-a-time", () => {
  it("formatOnboardingProgress exposes only the next field to ask", () => {
    const progress = formatOnboardingProgress(emptyMemory());
    expect(progress).toContain('Ask about this field ONLY next: "business_type"');
    expect(progress).toContain("What does your business do, in one sentence?");
    expect(progress).not.toContain("target_audience,");
    expect(progress).toContain("Remaining fields after this one:");
  });

  it("flags multi-question replies as needing repair", () => {
    const multi =
      "Great. What does your business do? And who is your target audience? Also, what's your brand voice?";
    expect(countQuestionMarks(multi)).toBeGreaterThan(1);
    expect(onboardingReplyNeedsFollowUp(multi)).toBe(true);
  });

  it("rewrites multi-question replies to a single next-field question", () => {
    const multi =
      "Thanks! What does your business do in one sentence? Who is your primary audience? How should content sound?";
    const { reply, repaired, nextField } = ensureOnboardingInterviewReply(multi, emptyMemory());
    expect(repaired).toBe(true);
    expect(nextField).toBe("business_type");
    expect(countQuestionMarks(reply)).toBe(1);
    expect(reply).toContain("What does your business do, in one sentence?");
    expect(reply).not.toContain("Who is your primary");
    expect(reply).not.toContain("How should your content sound");
  });

  it("keeps a clean single-field reply unchanged", () => {
    const clean =
      "Got it on the prior point.\n\nWhat does your business do, in one sentence?";
    // "Got it on the prior point." has no ?; full reply has exactly one ? and the next question.
    const { reply, repaired } = ensureOnboardingInterviewReply(clean, emptyMemory());
    expect(repaired).toBe(false);
    expect(reply).toBe(clean);
  });

  it("advances to the next missing field after business_type is captured", () => {
    const multi = "Nice. Who is your audience? What tone should we use?";
    const { reply, nextField, repaired } = ensureOnboardingInterviewReply(multi, memoryWithBusinessType());
    expect(repaired).toBe(true);
    expect(nextField).toBe("target_audience");
    expect(countQuestionMarks(reply)).toBe(1);
    expect(reply).toContain("Who is your primary target audience?");
  });
});
