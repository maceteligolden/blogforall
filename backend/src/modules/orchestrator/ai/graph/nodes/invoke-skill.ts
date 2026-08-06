import { randomUUID } from "crypto";
import type { SkillId } from "../../contracts/enums";
import type { PhaseListener } from "../../observability/phase-emitter";
import type { TurnTracer } from "../../observability/turn-tracer";
import type { SkillRegistry } from "../../skills/registry";
import type { OrchestratorState } from "../state";

export type InvokeSkillDeps = {
  registry: SkillRegistry;
  tracer?: TurnTracer;
  onPhase?: PhaseListener;
};

const SKILL_PHASE: Record<string, string> = {
  content_strategy: "strategy",
  research: "research",
  writing: "draft",
  content_optimization: "optimize",
};

/** invoke_skill — registry dispatch; merge patch; increment skills_run_this_turn. */
export async function invokeSkillNode(
  state: OrchestratorState,
  deps: InvokeSkillDeps
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

  const skill_run_id = randomUUID();
  const args = {
    ...(state.plan?.skill_args ?? {}),
    ...(state.skill_args ?? {}),
  };

  const writingAction = typeof args.action === "string" ? args.action : undefined;
  const coarsePhase =
    skillId === "writing" && writingAction === "outline"
      ? "outline"
      : skillId === "writing" && writingAction === "revise"
        ? "improve"
        : (SKILL_PHASE[skillId] ?? skillId);

  deps.onPhase?.({
    phase: coarsePhase,
    message: `Starting ${skillId}${writingAction ? `:${writingAction}` : ""}`,
    skill_id: skillId,
    meta: { skill_run_id, workflow_stage: state.workflow_stage },
  });

  const execute = async (): Promise<Partial<OrchestratorState>> => {
    try {
      const { patch, summary } = await deps.registry.run(skillId, state, args);
      deps.onPhase?.({
        phase: coarsePhase,
        message: summary,
        skill_id: skillId,
        meta: { skill_run_id, status: "ok" },
      });
      if (skillId === "writing" && writingAction === "draft" && (patch as { draft?: unknown }).draft) {
        deps.onPhase?.({
          phase: "draft_ready",
          message: "Draft ready — opening results",
          skill_id: skillId,
          meta: { skill_run_id, status: "ok" },
        });
      }
      return {
        ...patch,
        skills_run_this_turn: state.skills_run_this_turn + 1,
        active_skill: skillId,
        progress_events: [
          {
            type: "invoke_skill",
            message: summary,
            at: new Date().toISOString(),
            meta: { skill_id: skillId, skill_run_id, phase: coarsePhase },
          },
        ],
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      deps.onPhase?.({
        phase: coarsePhase,
        message: `Failed: ${message}`,
        skill_id: skillId,
        meta: { skill_run_id, status: "error" },
      });
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
  };

  if (!deps.tracer) return execute();

  const span = deps.tracer.startSpan("skill", {
    skill_id: skillId,
    skill_run_id,
    turn_id: state.turn_id,
    workspace_id: state.workspace_id,
  });
  try {
    const patch = await execute();
    const failed = patch.errors?.some((e) => e.code === "skill_failed");
    span.end({
      status: failed ? "error" : "ok",
      error: failed ? patch.errors?.[0]?.message : undefined,
      attrs: { skill_id: skillId, skill_run_id },
    });
    return patch;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    span.end({ status: "error", error: message });
    throw e;
  }
}
