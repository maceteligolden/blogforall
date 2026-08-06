import { describe, expect, it } from "@jest/globals";
import {
  countQuestionMarks,
  ensureOnboardingInterviewReply,
  formatOnboardingProgress,
  buildNextOnboardingQuestion,
  onboardingReplyNeedsFollowUp,
} from "../../../modules/orchestrator/utils/onboarding-interview.helper";
import {
  extractWebsiteUrl,
  isAffirmativeReply,
  isBusinessContextRefreshIntent,
  isNoWebsiteReply,
  isRejectReply,
  formatProposalSummary,
  proposalToMemoryPatch,
  WEBSITE_ONBOARDING_QUESTION,
  WEBSITE_PROPOSAL_CONFIRM_QUESTION,
} from "../../../modules/orchestrator/utils/website-onboarding.helper";
import type { WorkspaceMemory } from "../../../shared/schemas/workspace-memory.schema";

function emptyMemory(overrides: Partial<WorkspaceMemory> = {}): WorkspaceMemory {
  return {
    strategic: {},
    preferences: {},
    onboarding_path: "unset",
    pending_proposal: null,
    ...overrides,
  } as WorkspaceMemory;
}

function memoryWithBusinessDescription(): WorkspaceMemory {
  return {
    strategic: {
      business_description: "B2B SaaS analytics for growth teams",
      business_model: "b2b",
      industries: ["SaaS"],
    },
    preferences: {},
    onboarding_path: "secondary",
  } as WorkspaceMemory;
}

describe("website-first onboarding helpers", () => {
  it("extracts https URLs and bare domains", () => {
    expect(extractWebsiteUrl("https://acme.com/about")).toBe("https://acme.com/about");
    expect(extractWebsiteUrl("Check acme.io please")).toBe("https://acme.io");
    expect(extractWebsiteUrl("no link here")).toBeNull();
  });

  it("detects no-website and confirm/reject replies", () => {
    expect(isNoWebsiteReply("I don't have a website")).toBe(true);
    expect(isNoWebsiteReply("https://x.com")).toBe(false);
    expect(isAffirmativeReply("yes")).toBe(true);
    expect(isAffirmativeReply("looks good")).toBe(true);
    expect(isRejectReply("no")).toBe(true);
    expect(isRejectReply("chat instead")).toBe(true);
  });

  it("detects business context refresh intent", () => {
    expect(isBusinessContextRefreshIntent("Can you update my brand context?")).toBe(true);
    expect(isBusinessContextRefreshIntent("refresh business profile")).toBe(true);
    expect(isBusinessContextRefreshIntent("write a blog about cats")).toBe(false);
  });

  it("formats proposal summary with confirm question", () => {
    const summary = formatProposalSummary(
      {
        business_description: "SaaS analytics",
        target_audience: ["Founders"],
        brand_voice: "Expert and clear",
      },
      "https://acme.com"
    );
    expect(summary).toContain("https://acme.com");
    expect(summary).toContain("SaaS analytics");
    expect(summary).toContain(WEBSITE_PROPOSAL_CONFIRM_QUESTION);
  });

  it("maps proposal to memory patch", () => {
    const patch = proposalToMemoryPatch(
      {
        business_description: "Agency",
        tone: "casual",
        default_word_count: 900,
        memory_summary: "An agency",
        customers: [{ who: "Marketers", pain_points: "Busy", success: "Pipeline" }],
      },
      "https://agency.test"
    );
    expect(patch.strategic).toMatchObject({
      website_url: "https://agency.test",
      business_description: "Agency",
    });
    expect((patch.strategic as { customers: unknown[] }).customers).toHaveLength(1);
    expect(patch.preferences).toMatchObject({ tone: "casual", default_word_count: 900 });
    expect(patch.memory_summary).toBe("An agency");
  });
});

describe("onboarding interview one-field-at-a-time", () => {
  it("starts with the website gate when path is unset", () => {
    expect(buildNextOnboardingQuestion(emptyMemory())).toBe(WEBSITE_ONBOARDING_QUESTION);
    const progress = formatOnboardingProgress(emptyMemory());
    expect(progress).toContain("Phase: website gate");
    expect(progress).toContain(WEBSITE_ONBOARDING_QUESTION);
  });

  it("asks for proposal confirmation on primary path with pending proposal", () => {
    const memory = emptyMemory({
      onboarding_path: "primary",
      pending_proposal: { business_type: "Shop" },
    });
    expect(buildNextOnboardingQuestion(memory)).toBe(WEBSITE_PROPOSAL_CONFIRM_QUESTION);
    expect(formatOnboardingProgress(memory)).toContain("awaiting confirmation");
  });

  it("formatOnboardingProgress exposes only the next field on secondary path", () => {
    const progress = formatOnboardingProgress(emptyMemory({ onboarding_path: "secondary" }));
    expect(progress).toContain('Ask about this field ONLY next: "business_description"');
    expect(progress).toContain("Describe your business in a short paragraph");
    expect(progress).not.toContain("target_audience,");
    expect(progress).toContain("Remaining fields after this one:");
  });

  it("flags multi-question replies as needing repair", () => {
    const multi = "Great. What does your business do? And who is your target audience? Also, what's your brand voice?";
    expect(countQuestionMarks(multi)).toBeGreaterThan(1);
    expect(onboardingReplyNeedsFollowUp(multi)).toBe(true);
  });

  it("rewrites multi-question replies to a single next-field question on secondary path", () => {
    const multi =
      "Thanks! What does your business do in one sentence? Who is your primary audience? How should content sound?";
    const { reply, repaired, nextField } = ensureOnboardingInterviewReply(
      multi,
      emptyMemory({ onboarding_path: "secondary" })
    );
    expect(repaired).toBe(true);
    expect(nextField).toBe("business_description");
    expect(countQuestionMarks(reply)).toBe(1);
    expect(reply).toContain("Describe your business in a short paragraph");
    expect(reply).not.toContain("Who is your primary");
    expect(reply).not.toContain("How should your content sound");
  });

  it("does not repair replies during website gate or primary confirm", () => {
    const multi = "A? B?";
    const gate = ensureOnboardingInterviewReply(multi, emptyMemory({ onboarding_path: "unset" }));
    expect(gate.repaired).toBe(false);
    expect(gate.reply).toBe(multi);

    const primary = ensureOnboardingInterviewReply(
      multi,
      emptyMemory({ onboarding_path: "primary", pending_proposal: { business_description: "X" } })
    );
    expect(primary.repaired).toBe(false);
  });

  it("keeps a clean single-field reply unchanged", () => {
    const clean =
      "Got it on the prior point.\n\nDescribe your business in a short paragraph — what you do, who you serve, and what makes you different?";
    const { reply, repaired } = ensureOnboardingInterviewReply(clean, emptyMemory({ onboarding_path: "secondary" }));
    expect(repaired).toBe(false);
    expect(reply).toBe(clean);
  });

  it("advances to customers after description, model, and industries are captured", () => {
    const multi = "Nice. Who is your audience? What tone should we use?";
    const { reply, nextField, repaired } = ensureOnboardingInterviewReply(multi, memoryWithBusinessDescription());
    expect(repaired).toBe(true);
    expect(nextField).toBe("customers");
    expect(countQuestionMarks(reply)).toBe(1);
    expect(reply).toContain("Describe at least one customer persona");
  });
});
