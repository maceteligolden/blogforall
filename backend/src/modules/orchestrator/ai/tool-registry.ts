import { injectable } from "tsyringe";
import type { OrchestratorTool } from "../interfaces/orchestrator.interface";

/**
 * Process-wide registry of orchestrator tools. Specialist tool modules
 * (Phase 3+) call `register()` on their tsyringe-resolved constructor so the
 * supervisor can discover them. The registry is intentionally simple — a
 * Map keyed by tool name — so we can reason about tenant-scoping at the
 * call site rather than inside a complex DI container.
 */
@injectable()
export class OrchestratorToolRegistry {
  private readonly tools = new Map<string, OrchestratorTool>();

  register(tool: OrchestratorTool): void {
    if (this.tools.has(tool.name)) {
      // Overwriting is a programmer error; surface immediately during boot.
      throw new Error(`Orchestrator tool already registered: ${tool.name}`);
    }
    this.tools.set(tool.name, tool);
  }

  get(name: string): OrchestratorTool | undefined {
    return this.tools.get(name);
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  list(): OrchestratorTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Names + one-line descriptions of every registered tool. Rendered into the
   * supervisor's system prompt so the model knows what is invokable.
   */
  manifest(): Array<{ name: string; description: string; requiresConfirmation: boolean }> {
    return this.list().map((t) => ({
      name: t.name,
      description: t.description,
      requiresConfirmation: t.requiresConfirmation,
    }));
  }
}
