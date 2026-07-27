import { describe, expect, it } from "@jest/globals";
import { env } from "../../../../shared/config/env";
import { CHECKPOINT_DENYLIST } from "../../../../modules/orchestrator/ai/graph/checkpoint-allowlist";
import { skillIdSchema } from "../../../../modules/orchestrator/ai/contracts/enums";

describe("T5.1 / T5.2 single-brain defaults", () => {
  it("defaults v0.5 graph on and keeps cognition disabled", () => {
    expect(env.orchestrator.v05GraphEnabled).toBe(true);
    expect(env.cognition.enabled).toBe(false);
  });

  it("checkpoint denylist no longer references retired understand channel", () => {
    expect([...CHECKPOINT_DENYLIST]).not.toContain("understand");
  });

  it("v0.5 skill ids exclude review (ADR-005)", () => {
    expect(skillIdSchema.safeParse("review").success).toBe(false);
    expect(skillIdSchema.safeParse("content_optimization").success).toBe(true);
  });
});
