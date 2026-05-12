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
import { BlogGetTool, BlogListTool, BlogStatisticsTool } from "./tools/blog-read.tools";
import {
  BlogCreateDraftTool,
  BlogDuplicateTool,
  BlogGenerateDraftTool,
  BlogUpdateTool,
} from "./tools/blog-write.tools";
import {
  BlogCancelScheduleTool,
  BlogPublishTool,
  BlogRescheduleTool,
  BlogScheduleTool,
  BlogUnpublishTool,
} from "./tools/blog-publish.tools";
import { BlogDeleteTool } from "./tools/blog-destructive.tools";
import {
  ScheduledCancelTool,
  ScheduledGetTool,
  ScheduledListTool,
  ScheduledUpcomingThisWeekTool,
} from "./tools/scheduled.tools";

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
    private readonly categoryRemoveFromBlog: CategoryRemoveFromBlogTool,
    // Blog read tools
    private readonly blogList: BlogListTool,
    private readonly blogGet: BlogGetTool,
    private readonly blogStatistics: BlogStatisticsTool,
    // Blog write tools
    private readonly blogCreateDraft: BlogCreateDraftTool,
    private readonly blogUpdate: BlogUpdateTool,
    private readonly blogDuplicate: BlogDuplicateTool,
    private readonly blogGenerateDraft: BlogGenerateDraftTool,
    // Blog publishing tools
    private readonly blogPublish: BlogPublishTool,
    private readonly blogUnpublish: BlogUnpublishTool,
    private readonly blogSchedule: BlogScheduleTool,
    private readonly blogReschedule: BlogRescheduleTool,
    private readonly blogCancelSchedule: BlogCancelScheduleTool,
    // Destructive
    private readonly blogDelete: BlogDeleteTool,
    // Scheduled posts
    private readonly scheduledList: ScheduledListTool,
    private readonly scheduledGet: ScheduledGetTool,
    private readonly scheduledUpcomingThisWeek: ScheduledUpcomingThisWeekTool,
    private readonly scheduledCancel: ScheduledCancelTool
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
      this.blogList,
      this.blogGet,
      this.blogStatistics,
      this.blogCreateDraft,
      this.blogUpdate,
      this.blogDuplicate,
      this.blogGenerateDraft,
      this.blogPublish,
      this.blogUnpublish,
      this.blogSchedule,
      this.blogReschedule,
      this.blogCancelSchedule,
      this.blogDelete,
      this.scheduledList,
      this.scheduledGet,
      this.scheduledUpcomingThisWeek,
      this.scheduledCancel,
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
