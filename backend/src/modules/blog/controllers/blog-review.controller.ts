import { injectable } from "tsyringe";
import { Request, Response, NextFunction } from "express";
import { BlogReviewService } from "../services/blog-review.service";
import { BlogService } from "../services/blog.service";
import { sendSuccess } from "../../../shared/helper/response.helper";
import { BadRequestError, NotFoundError, ForbiddenError } from "../../../shared/errors";
import { BlogStatus } from "../../../shared/constants";
import { blocksToHtml } from "../../../shared/utils/content-blocks.util";
import type { ContentBlock } from "../../../shared/schemas/blog.schema";
import type { UpdateBlogInput } from "../interfaces/blog.interface";
import { getJwtUserId } from "../../../shared/utils/jwt-user";

@injectable()
export class BlogReviewController {
  constructor(
    private blogReviewService: BlogReviewService,
    private blogService: BlogService
  ) {}

  reviewBlog = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getJwtUserId(req);
      const params = req.validatedParams as { siteId: string; blogId?: string };
      const blogId = params.blogId;
      const siteId = params.siteId;
      const body = req.validatedBody as {
        title?: string;
        content?: string;
        excerpt?: string;
        category?: string;
        content_blocks?: unknown[];
      };
      const { title, content, excerpt, category, content_blocks: bodyContentBlocks } = body;

      let blog = null;
      if (blogId) {
        blog = await this.blogService.getBlogById(blogId, siteId, userId);
        if (!blog) {
          return next(new NotFoundError("Blog not found"));
        }

        if (blog.status !== BlogStatus.DRAFT) {
          return next(new ForbiddenError("Only draft blog posts can be reviewed"));
        }

        if (blog.author !== userId) {
          return next(new ForbiddenError("You can only review your own blog posts"));
        }
      }

      const reviewTitle = title || blog?.title || "";
      let reviewContent = content ?? blog?.content ?? "";
      const reviewExcerpt = excerpt !== undefined ? excerpt : blog?.excerpt;
      const reviewCategory = category || blog?.category;
      const content_blocks =
        bodyContentBlocks && Array.isArray(bodyContentBlocks) && bodyContentBlocks.length > 0
          ? bodyContentBlocks
          : (blog as { content_blocks?: unknown[] })?.content_blocks;

      if (!reviewTitle) {
        return next(new BadRequestError("Title is required"));
      }
      if (!reviewContent && (!content_blocks || content_blocks.length === 0)) {
        return next(new BadRequestError("Content or content_blocks is required"));
      }
      if (content_blocks?.length && !reviewContent) {
        reviewContent = blocksToHtml(content_blocks as ContentBlock[]);
      }

      const reviewResult = await this.blogReviewService.reviewBlog(
        reviewTitle,
        reviewContent,
        reviewExcerpt,
        reviewCategory,
        content_blocks as ContentBlock[] | undefined
      );

      sendSuccess(res, "Blog review completed", reviewResult);
    } catch (error) {
      next(error);
    }
  };

  applyReview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getJwtUserId(req);
      const { blogId, siteId } = req.validatedParams as { siteId: string; blogId: string };
      const { improved_content, improved_title, improved_excerpt } = req.validatedBody as {
        improved_content?: string;
        improved_title?: string;
        improved_excerpt?: string;
      };

      const blog = await this.blogService.getBlogById(blogId, siteId, userId);
      if (!blog) {
        return next(new NotFoundError("Blog not found"));
      }

      if (blog.status !== BlogStatus.DRAFT) {
        return next(new ForbiddenError("Only draft blog posts can be updated with review suggestions"));
      }

      if (blog.author !== userId) {
        return next(new ForbiddenError("You can only update your own blog posts"));
      }

      const currentVersion = (blog.version_history?.length || 0) + 1;
      const versionHistory = blog.version_history || [];

      versionHistory.push({
        version: currentVersion,
        content: blog.content,
        title: blog.title,
        excerpt: blog.excerpt,
        created_at: new Date(),
      });

      const updateData: UpdateBlogInput = {
        version_history: versionHistory,
      };

      if (improved_content !== undefined) {
        updateData.content = improved_content;
      }
      if (improved_title !== undefined) {
        updateData.title = improved_title;
      }
      if (improved_excerpt !== undefined) {
        updateData.excerpt = improved_excerpt;
      }
      const updatedBlog = await this.blogService.updateBlog(blogId, siteId, userId, updateData);

      sendSuccess(res, "Review suggestions applied successfully", updatedBlog);
    } catch (error) {
      next(error);
    }
  };

  applyOne = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getJwtUserId(req);
      const { blogId, siteId } = req.validatedParams as { siteId: string; blogId: string };
      const { target, original, suggestion, blockId, blockIndex } = req.validatedBody as {
        target: "title" | "excerpt" | "content";
        original: string;
        suggestion: string;
        blockId?: string;
        blockIndex?: number;
      };

      const blog = await this.blogService.getBlogById(blogId, siteId, userId);
      if (!blog) {
        return next(new NotFoundError("Blog not found"));
      }
      if (blog.status !== BlogStatus.DRAFT) {
        return next(new ForbiddenError("Only draft blog posts can be updated with review suggestions"));
      }
      if (blog.author !== userId) {
        return next(new ForbiddenError("You can only update your own blog posts"));
      }

      const versionHistory = blog.version_history || [];
      versionHistory.push({
        version: versionHistory.length + 1,
        content: blog.content,
        title: blog.title,
        excerpt: blog.excerpt,
        created_at: new Date(),
      });

      let newTitle = blog.title;
      let newExcerpt = blog.excerpt;
      let newContent = blog.content;
      let newContentBlocks: ContentBlock[] | undefined = (blog as { content_blocks?: ContentBlock[] }).content_blocks;

      if (target === "title") {
        newTitle = suggestion;
      } else if (target === "excerpt") {
        newExcerpt = suggestion;
      } else if (target === "content") {
        const blocks = newContentBlocks && newContentBlocks.length > 0 ? newContentBlocks : null;
        if (blocks) {
          const idx =
            blockIndex !== undefined && blockIndex >= 0 && blockIndex < blocks.length
              ? blockIndex
              : blockId != null
                ? blocks.findIndex((b) => b.id === blockId)
                : -1;
          if (idx >= 0) {
            const block = blocks[idx];
            if (block.data.text != null && block.data.text.includes(original)) {
              block.data.text = block.data.text.replace(original, suggestion);
            } else if (block.data.items && block.data.items.some((item) => item.includes(original))) {
              block.data.items = block.data.items.map((item) =>
                item.includes(original) ? item.replace(original, suggestion) : item
              );
            }
            newContentBlocks = [...blocks];
            newContent = blocksToHtml(newContentBlocks);
          } else {
            newContent = newContent.replace(original, suggestion);
          }
        } else {
          newContent = newContent.replace(original, suggestion);
        }
      }

      const updateData: UpdateBlogInput = {
        version_history: versionHistory,
        title: newTitle,
        excerpt: newExcerpt,
        content: newContent,
        ...(newContentBlocks ? { content_blocks: newContentBlocks } : {}),
      };

      const updatedBlog = await this.blogService.updateBlog(blogId, siteId, userId, updateData);
      sendSuccess(res, "Suggestion applied", updatedBlog);
    } catch (error) {
      next(error);
    }
  };

  restoreVersion = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getJwtUserId(req);
      const { blogId, version, siteId } = req.validatedParams as {
        siteId: string;
        blogId: string;
        version: string;
      };
      const versionNumber = parseInt(version, 10);

      if (isNaN(versionNumber)) {
        return next(new BadRequestError("Blog ID and valid version number are required"));
      }

      const blog = await this.blogService.getBlogById(blogId, siteId, userId);
      if (!blog) {
        return next(new NotFoundError("Blog not found"));
      }

      if (blog.author !== userId) {
        return next(new ForbiddenError("You can only restore versions of your own blog posts"));
      }

      const versionHistory = blog.version_history || [];
      const targetVersion = versionHistory.find((v) => v.version === versionNumber);

      if (!targetVersion) {
        return next(new NotFoundError(`Version ${versionNumber} not found`));
      }

      const currentVersion = versionHistory.length + 1;
      versionHistory.push({
        version: currentVersion,
        content: blog.content,
        title: blog.title,
        excerpt: blog.excerpt,
        created_at: new Date(),
      });

      const updatedBlog = await this.blogService.updateBlog(blogId, siteId, userId, {
        content: targetVersion.content,
        title: targetVersion.title,
        excerpt: targetVersion.excerpt,
        version_history: versionHistory,
      });

      sendSuccess(res, `Version ${versionNumber} restored successfully`, updatedBlog);
    } catch (error) {
      next(error);
    }
  };
}
