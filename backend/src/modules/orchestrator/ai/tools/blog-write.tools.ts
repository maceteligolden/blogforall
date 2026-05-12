import { injectable } from "tsyringe";
import { z } from "zod";
import { BlogService } from "../../../blog/services/blog.service";
import { BlogGenerationService } from "../../../blog/services/blog-generation.service";
import { WorkspaceMemoryRepository } from "../../repositories/workspace-memory.repository";
import { BlogStatus } from "../../../../shared/constants";
import type {
  OrchestratorTool,
  OrchestratorToolInvocation,
  OrchestratorToolResult,
} from "../../interfaces/orchestrator.interface";
import { parseToolInput, truncateSummary } from "./_helpers";

// -----------------------------------------------------------------------------
// blogs.createDraft
// -----------------------------------------------------------------------------

const createDraftInputSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(80_000),
  content_type: z.enum(["html", "markdown"]).optional(),
  excerpt: z.string().max(500).optional(),
  category: z.string().min(1).optional(),
  meta: z
    .object({
      description: z.string().max(500).optional(),
      keywords: z.array(z.string()).max(30).optional(),
    })
    .optional(),
});

@injectable()
export class BlogCreateDraftTool implements OrchestratorTool {
  name = "blogs.createDraft";
  description =
    "Create a new draft blog post from explicit title + content. Use this when the user has already provided text. For prompt-driven AI generation, use blogs.generateDraft instead.";
  requiresConfirmation = false;
  constructor(private readonly blogService: BlogService) {}

  async run(invocation: OrchestratorToolInvocation): Promise<OrchestratorToolResult> {
    const input = parseToolInput(createDraftInputSchema, invocation.input, this.name);
    const blog = await this.blogService.createBlog(invocation.userId, invocation.siteId, {
      title: input.title,
      content: input.content,
      content_type: input.content_type,
      excerpt: input.excerpt,
      category: input.category,
      meta: input.meta,
      status: BlogStatus.DRAFT,
    });
    return {
      summary: `Draft '${blog.title}' created (id ${blog._id?.toString()}).`,
      data: { id: blog._id?.toString(), title: blog.title, slug: blog.slug, status: blog.status },
    };
  }
}

// -----------------------------------------------------------------------------
// blogs.update (non-destructive edits)
// -----------------------------------------------------------------------------

const updateInputSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1).max(80_000).optional(),
  excerpt: z.string().max(500).optional(),
  category: z.string().min(1).optional(),
  meta: z
    .object({
      description: z.string().max(500).optional(),
      keywords: z.array(z.string()).max(30).optional(),
    })
    .optional(),
});

@injectable()
export class BlogUpdateTool implements OrchestratorTool {
  name = "blogs.update";
  description = "Update a blog post's title, content, excerpt, category, or meta.";
  requiresConfirmation = false;
  constructor(private readonly blogService: BlogService) {}

  async run(invocation: OrchestratorToolInvocation): Promise<OrchestratorToolResult> {
    const { id, ...rest } = parseToolInput(updateInputSchema, invocation.input, this.name);
    const updated = await this.blogService.updateBlog(id, invocation.siteId, invocation.userId, rest);
    return {
      summary: `Updated blog '${updated.title}'.`,
      data: { id: updated._id?.toString(), title: updated.title, status: updated.status },
    };
  }
}

// -----------------------------------------------------------------------------
// blogs.duplicate
// -----------------------------------------------------------------------------

const duplicateInputSchema = z.object({
  id: z.string().min(1),
  new_title: z.string().min(1).max(200).optional(),
});

@injectable()
export class BlogDuplicateTool implements OrchestratorTool {
  name = "blogs.duplicate";
  description = "Duplicate an existing blog post into a new draft (status=draft).";
  requiresConfirmation = false;
  constructor(private readonly blogService: BlogService) {}

  async run(invocation: OrchestratorToolInvocation): Promise<OrchestratorToolResult> {
    const input = parseToolInput(duplicateInputSchema, invocation.input, this.name);
    const original = await this.blogService.getBlogById(input.id, invocation.siteId);
    const title = input.new_title || `${original.title} (copy)`;
    const blog = await this.blogService.createBlog(invocation.userId, invocation.siteId, {
      title,
      content: original.content,
      excerpt: original.excerpt,
      category: original.category,
      meta: original.meta,
      status: BlogStatus.DRAFT,
    });
    return {
      summary: `Duplicated '${original.title}' into new draft '${blog.title}'.`,
      data: { id: blog._id?.toString(), title: blog.title, source_id: input.id },
    };
  }
}

// -----------------------------------------------------------------------------
// blogs.generateDraft — AI generation using the existing LangGraph pipeline.
// Workspace memory is injected as userParams so brand voice / audience flow in.
// -----------------------------------------------------------------------------

const generateDraftInputSchema = z.object({
  prompt: z.string().min(10).max(2000),
  tone: z.string().max(200).optional(),
  word_count: z.number().int().min(300).max(8000).optional(),
  topics_to_explore: z.array(z.string()).max(20).optional(),
  /** Persist the result as a draft. Defaults to true. */
  save_as_draft: z.boolean().optional(),
  category: z.string().min(1).optional(),
});

@injectable()
export class BlogGenerateDraftTool implements OrchestratorTool {
  name = "blogs.generateDraft";
  description =
    "Generate a new blog post from a prompt. The orchestrator passes workspace brand voice, audience, and tone into the generation pipeline. By default the generated content is saved as a draft (set save_as_draft=false to preview without saving).";
  requiresConfirmation = false;
  constructor(
    private readonly generationService: BlogGenerationService,
    private readonly blogService: BlogService,
    private readonly memoryRepository: WorkspaceMemoryRepository
  ) {}

  async run(invocation: OrchestratorToolInvocation): Promise<OrchestratorToolResult> {
    const input = parseToolInput(generateDraftInputSchema, invocation.input, this.name);
    const memory = await this.memoryRepository.ensureForSite(invocation.siteId);

    const userParams = {
      tone: input.tone || memory.preferences.tone,
      word_count: input.word_count ?? memory.preferences.default_word_count,
      topics_to_explore: input.topics_to_explore,
      target_audience: memory.strategic.target_audience?.join(", ") || undefined,
      purpose: memory.strategic.business_goals?.[0],
    };

    const analysis = await this.generationService.analyzePrompt(input.prompt, userParams);
    if (!analysis.is_valid) {
      return {
        summary: `I couldn't generate a draft: ${analysis.rejection_reason || "the prompt was rejected by the planner."}`,
        data: { analysis },
      };
    }

    const { content, review } = await this.generationService.generateWithReview(
      input.prompt,
      analysis,
      userParams
    );

    const saveAsDraft = input.save_as_draft !== false;
    let savedBlogId: string | undefined;
    if (saveAsDraft) {
      const created = await this.blogService.createBlog(invocation.userId, invocation.siteId, {
        title: content.title,
        content: content.content,
        excerpt: content.excerpt,
        meta: content.meta,
        category: input.category,
        status: BlogStatus.DRAFT,
      });
      savedBlogId = created._id?.toString();
    }

    return {
      summary: truncateSummary(
        `Generated '${content.title}' (${content.content.length.toLocaleString()} chars).${savedBlogId ? ` Saved as draft ${savedBlogId}.` : ""}`
      ),
      data: {
        blog_id: savedBlogId,
        title: content.title,
        excerpt: content.excerpt,
        review_score: review.overall_score,
        review_summary: review.summary,
        saved_as_draft: !!savedBlogId,
      },
    };
  }
}
