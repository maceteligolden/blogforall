import { injectable } from "tsyringe";
import { z } from "zod";
import { BlogService } from "../../../blog/services/blog.service";
import { OrchestratorApprovalKind } from "../../../../shared/schemas/orchestrator-approval.schema";
import type {
  OrchestratorTool,
  OrchestratorToolInvocation,
  OrchestratorToolResult,
} from "../../interfaces/orchestrator.interface";
import { parseToolInput } from "./_helpers";

// -----------------------------------------------------------------------------
// blogs.delete — destructive; always gated by in-chat confirmation.
// -----------------------------------------------------------------------------

const deleteInputSchema = z.object({ id: z.string().min(1) });

@injectable()
export class BlogDeleteTool implements OrchestratorTool {
  name = "blogs.delete";
  description =
    "Permanently delete a blog post. Destructive: confirmation is required. Posts that are currently scheduled cannot be deleted until their schedule is cancelled.";
  requiresConfirmation = true;
  confirmationKind = OrchestratorApprovalKind.IN_CHAT_CONFIRMATION;
  constructor(private readonly blogService: BlogService) {}

  async run(invocation: OrchestratorToolInvocation): Promise<OrchestratorToolResult> {
    const input = parseToolInput(deleteInputSchema, invocation.input, this.name);
    // Resolve the title before delete so the summary is helpful.
    const before = await this.blogService.getBlogById(input.id, invocation.siteId);
    await this.blogService.deleteBlog(input.id, invocation.siteId, invocation.userId);
    return {
      summary: `Deleted blog '${before.title}'.`,
      data: { id: input.id, title: before.title },
    };
  }
}
