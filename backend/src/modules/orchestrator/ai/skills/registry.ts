import type { SkillId } from "../contracts/enums";
import type { OrchestratorState } from "../graph/state";

export type SkillHandlerResult = {
  patch: Partial<OrchestratorState>;
  summary: string;
};

export type SkillHandler = (state: OrchestratorState, args: Record<string, unknown>) => Promise<SkillHandlerResult>;

/**
 * Thin skill registry (doc 06 / 15). Graph invoke_skill dispatches here.
 */
export class SkillRegistry {
  private readonly handlers = new Map<SkillId, SkillHandler>();

  register(id: SkillId, handler: SkillHandler): void {
    this.handlers.set(id, handler);
  }

  has(id: SkillId): boolean {
    return this.handlers.has(id);
  }

  async run(id: SkillId, state: OrchestratorState, args: Record<string, unknown> = {}): Promise<SkillHandlerResult> {
    const handler = this.handlers.get(id);
    if (!handler) {
      throw new Error(`Skill not registered: ${id}`);
    }
    return handler(state, args);
  }
}
