import { injectable } from "tsyringe";
import { z } from "zod";
import { CategoryService } from "../../../category/services/category.service";
import { BlogService } from "../../../blog/services/blog.service";
import { OrchestratorApprovalKind } from "../../../../shared/schemas/orchestrator-approval.schema";
import type {
  OrchestratorTool,
  OrchestratorToolInvocation,
  OrchestratorToolResult,
} from "../../interfaces/orchestrator.interface";
import { parseToolInput, truncateSummary } from "./_helpers";

// -----------------------------------------------------------------------------
// categories.list
// -----------------------------------------------------------------------------

const listInputSchema = z.object({
  include_inactive: z.boolean().optional(),
  as_tree: z.boolean().optional(),
});

@injectable()
export class CategoryListTool implements OrchestratorTool {
  name = "categories.list";
  description =
    "List categories in the current workspace. Set as_tree=true to receive the nested structure with children; set include_inactive=true to include soft-deleted categories.";
  requiresConfirmation = false;
  constructor(private readonly categoryService: CategoryService) {}

  async run(invocation: OrchestratorToolInvocation): Promise<OrchestratorToolResult> {
    const input = parseToolInput(listInputSchema, invocation.input, this.name);
    if (input.as_tree) {
      const tree = await this.categoryService.getSiteCategoriesTree(
        invocation.siteId,
        input.include_inactive ?? false
      );
      return {
        summary: truncateSummary(`Workspace has ${tree.length} top-level categories.`),
        data: { tree },
      };
    }
    const flat = await this.categoryService.getSiteCategories(
      invocation.siteId,
      input.include_inactive ?? false
    );
    return {
      summary: truncateSummary(`Workspace has ${flat.length} categories: ${flat.slice(0, 8).map((c) => c.name).join(", ")}${flat.length > 8 ? "..." : ""}.`),
      data: {
        categories: flat.map((c) => ({
          id: c._id?.toString(),
          name: c.name,
          slug: c.slug,
          parent: c.parent,
          color: c.color,
          is_active: c.is_active,
        })),
      },
    };
  }
}

// -----------------------------------------------------------------------------
// categories.get
// -----------------------------------------------------------------------------

const getInputSchema = z.object({ id: z.string().min(1) });

@injectable()
export class CategoryGetTool implements OrchestratorTool {
  name = "categories.get";
  description = "Fetch a single category by id.";
  requiresConfirmation = false;
  constructor(private readonly categoryService: CategoryService) {}

  async run(invocation: OrchestratorToolInvocation): Promise<OrchestratorToolResult> {
    const input = parseToolInput(getInputSchema, invocation.input, this.name);
    const category = await this.categoryService.getCategoryById(input.id, invocation.siteId);
    return {
      summary: `Category '${category.name}' (slug: ${category.slug}).`,
      data: category,
    };
  }
}

// -----------------------------------------------------------------------------
// categories.create
// -----------------------------------------------------------------------------

const createInputSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  parent: z.string().min(1).optional(),
  color: z.string().max(20).optional(),
});

@injectable()
export class CategoryCreateTool implements OrchestratorTool {
  name = "categories.create";
  description =
    "Create a new category. Optional parent (category id) nests it; optional color is a UI hex/string.";
  requiresConfirmation = false;
  constructor(private readonly categoryService: CategoryService) {}

  async run(invocation: OrchestratorToolInvocation): Promise<OrchestratorToolResult> {
    const input = parseToolInput(createInputSchema, invocation.input, this.name);
    const created = await this.categoryService.createCategory(invocation.siteId, input);
    return {
      summary: `Created category '${created.name}'.`,
      data: { id: created._id?.toString(), name: created.name, slug: created.slug },
    };
  }
}

// -----------------------------------------------------------------------------
// categories.update
// -----------------------------------------------------------------------------

const updateInputSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  parent: z.string().min(1).optional(),
  color: z.string().max(20).optional(),
  is_active: z.boolean().optional(),
});

@injectable()
export class CategoryUpdateTool implements OrchestratorTool {
  name = "categories.update";
  description = "Update a category's name, description, parent, color, or active flag.";
  requiresConfirmation = false;
  constructor(private readonly categoryService: CategoryService) {}

  async run(invocation: OrchestratorToolInvocation): Promise<OrchestratorToolResult> {
    const { id, ...rest } = parseToolInput(updateInputSchema, invocation.input, this.name);
    const updated = await this.categoryService.updateCategory(id, invocation.siteId, rest);
    return {
      summary: `Updated category '${updated.name}'.`,
      data: updated,
    };
  }
}

// -----------------------------------------------------------------------------
// categories.delete (destructive — gated by in-chat confirmation)
// -----------------------------------------------------------------------------

const deleteInputSchema = z.object({ id: z.string().min(1) });

@injectable()
export class CategoryDeleteTool implements OrchestratorTool {
  name = "categories.delete";
  description = "Permanently delete a category. Destructive: confirmation is required.";
  requiresConfirmation = true;
  confirmationKind = OrchestratorApprovalKind.IN_CHAT_CONFIRMATION;
  constructor(private readonly categoryService: CategoryService) {}

  async run(invocation: OrchestratorToolInvocation): Promise<OrchestratorToolResult> {
    const input = parseToolInput(deleteInputSchema, invocation.input, this.name);
    const before = await this.categoryService.getCategoryById(input.id, invocation.siteId);
    await this.categoryService.deleteCategory(input.id, invocation.siteId);
    return {
      summary: `Deleted category '${before.name}'.`,
      data: { id: input.id, name: before.name },
    };
  }
}

// -----------------------------------------------------------------------------
// categories.assignToBlog / categories.removeFromBlog
// (Blogs have a single category field, so "remove" sets it to undefined.)
// -----------------------------------------------------------------------------

const assignInputSchema = z.object({
  blog_id: z.string().min(1),
  category_id: z.string().min(1),
});

@injectable()
export class CategoryAssignToBlogTool implements OrchestratorTool {
  name = "categories.assignToBlog";
  description = "Assign a category to a blog post (replaces any existing category).";
  requiresConfirmation = false;
  constructor(
    private readonly blogService: BlogService,
    private readonly categoryService: CategoryService
  ) {}

  async run(invocation: OrchestratorToolInvocation): Promise<OrchestratorToolResult> {
    const input = parseToolInput(assignInputSchema, invocation.input, this.name);
    const category = await this.categoryService.getCategoryById(input.category_id, invocation.siteId);
    const updated = await this.blogService.updateBlog(input.blog_id, invocation.siteId, invocation.userId, {
      category: input.category_id,
    });
    return {
      summary: `Assigned category '${category.name}' to '${updated.title}'.`,
      data: { blog_id: updated._id?.toString(), category_id: input.category_id },
    };
  }
}

const removeFromBlogInputSchema = z.object({ blog_id: z.string().min(1) });

@injectable()
export class CategoryRemoveFromBlogTool implements OrchestratorTool {
  name = "categories.removeFromBlog";
  description = "Clear the category from a blog post.";
  requiresConfirmation = false;
  constructor(private readonly blogService: BlogService) {}

  async run(invocation: OrchestratorToolInvocation): Promise<OrchestratorToolResult> {
    const input = parseToolInput(removeFromBlogInputSchema, invocation.input, this.name);
    const updated = await this.blogService.updateBlog(
      input.blog_id,
      invocation.siteId,
      invocation.userId,
      { category: undefined }
    );
    return {
      summary: `Removed category from '${updated.title}'.`,
      data: { blog_id: updated._id?.toString() },
    };
  }
}
