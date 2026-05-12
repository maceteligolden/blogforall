import { injectable } from "tsyringe";
import { logger } from "../../../shared/utils/logger";
import { OrchestratorToolRegistry } from "./tool-registry";
import {
  WorkspaceCompleteOnboardingTool,
  WorkspaceGetMemoryTool,
  WorkspaceRenameTool,
  WorkspaceUpdateMemoryTool,
} from "./tools/workspace.tools";

/**
 * Boots the orchestrator's tool surface. Called once from server startup
 * AFTER the database is connected. Each specialist tool is `@injectable()`
 * and gets resolved by tsyringe here, then registered with the singleton
 * tool registry.
 *
 * Adding a new tool? Inject it in the constructor and push it into the
 * array below. Re-registration of an existing tool name throws, which is
 * exactly what we want at boot time.
 */
@injectable()
export class OrchestratorBootstrap {
  constructor(
    private readonly registry: OrchestratorToolRegistry,
    // Workspace tools
    private readonly workspaceRename: WorkspaceRenameTool,
    private readonly workspaceGetMemory: WorkspaceGetMemoryTool,
    private readonly workspaceUpdateMemory: WorkspaceUpdateMemoryTool,
    private readonly workspaceCompleteOnboarding: WorkspaceCompleteOnboardingTool
  ) {}

  registerAllTools(): void {
    const tools = [
      this.workspaceRename,
      this.workspaceGetMemory,
      this.workspaceUpdateMemory,
      this.workspaceCompleteOnboarding,
    ];
    for (const tool of tools) {
      this.registry.register(tool);
    }
    logger.info(
      "Orchestrator tools registered",
      { count: tools.length, tools: tools.map((t) => t.name) },
      "OrchestratorBootstrap"
    );
  }
}
