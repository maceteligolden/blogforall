import { injectable } from "tsyringe";
import { logger } from "../../../shared/utils/logger";
import { OrchestratorToolRegistry } from "./tool-registry";
import {
  WorkspaceCompleteOnboardingTool,
  WorkspaceGetMemoryTool,
  WorkspaceRenameTool,
  WorkspaceUpdateMemoryTool,
} from "./tools/workspace.tools";
import {
  CategoryAssignToBlogTool,
  CategoryCreateTool,
  CategoryDeleteTool,
  CategoryGetTool,
  CategoryListTool,
  CategoryRemoveFromBlogTool,
  CategoryUpdateTool,
} from "./tools/category.tools";

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
    private readonly workspaceCompleteOnboarding: WorkspaceCompleteOnboardingTool,
    // Category tools
    private readonly categoryList: CategoryListTool,
    private readonly categoryGet: CategoryGetTool,
    private readonly categoryCreate: CategoryCreateTool,
    private readonly categoryUpdate: CategoryUpdateTool,
    private readonly categoryDelete: CategoryDeleteTool,
    private readonly categoryAssignToBlog: CategoryAssignToBlogTool,
    private readonly categoryRemoveFromBlog: CategoryRemoveFromBlogTool
  ) {}

  registerAllTools(): void {
    const tools = [
      this.workspaceRename,
      this.workspaceGetMemory,
      this.workspaceUpdateMemory,
      this.workspaceCompleteOnboarding,
      this.categoryList,
      this.categoryGet,
      this.categoryCreate,
      this.categoryUpdate,
      this.categoryDelete,
      this.categoryAssignToBlog,
      this.categoryRemoveFromBlog,
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
