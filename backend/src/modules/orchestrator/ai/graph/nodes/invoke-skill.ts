import type { SkillId } from "../../contracts/enums";
import type { SkillRegistry } from "../../skills/registry";
import type { OrchestratorState } from "../state";

export type InvokeSkillDeps = {
  registry: SkillRegistry;
};

/** invoke_skill — registry dispatch; merge patch; increment skills_run_this_turn. */
export async function invokeSkillNode(
  state: OrchestratorState,
  deps: InvokeSkillDeps,
): Promise<Partial<OrchestratorState>> {
  const skillId = (state.plan?.skill_id ?? state.active_skill) as SkillId | undefined;
  if (!skillId) {
    return {
      errors: [
        {
          code: "missing_skill",
          message: "plan.next=invoke_skill but no skill_id",
          recoverable: true,
        },
      ],
      recovery: { action: "ask_user", rationale: "Missing skill id" },
    };
  }

  try {
    const args = {
      ...(state.plan?.skill_args ?? {}),
      ...(state.skill_args ?? {}),
    };
    const { patch, summary } = await deps.registry.run(skillId, state, args);
    return {
      ...patch,
      skills_run_this_turn: state.skills_run_this_turn + 1,
      active_skill: skillId,
      progress_events: [
        {
          type: "invoke_skill",
          message: summary,
          at: new Date().toISOString(),
          meta: { skill_id: skillId },
        },
      ],
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return {
      skills_run_this_turn: state.skills_run_this_turn + 1,
      errors: [
        {
          code: "skill_failed",
          message,
          skill_id: skillId,
          recoverable: true,
        },
      ],
      recovery: { action: "ask_user", rationale: message },
    };
  }
}
