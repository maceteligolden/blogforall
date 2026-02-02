import { injectable } from "tsyringe";
import { Request, Response, NextFunction } from "express";
import { BlogReviewService } from "../services/blog-review.service";
import { BlogService } from "../services/blog.service";
import { sendSuccess } from "../../../shared/helper/response.helper";
import { BadRequestError, NotFoundError, ForbiddenError } from "../../../shared/errors";
import { BlogStatus } from "../../../shared/constants";

@injectable()
export class BlogReviewController {
  constructor(
    private blogReviewService: BlogReviewService,
    private blogService: BlogService
  ) {}

  /**
   * Review a blog post (only for draft posts)
   */
  async reviewBlog(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return next(new BadRequestError("User not authenticated"));
      }

      const { blogId } = req.params;
      const { title, content, excerpt, category } = req.body;

      // If blogId is provided, fetch the blog
      const siteId = req.user?.currentSiteId;
      if (!siteId) {
        return next(new BadRequestError("Site context is required"));
      }

      let blog = null;
      if (blogId) {
        blog = await this.blogService.getBlogById(blogId, siteId, userId);
        if (!blog) {
          return next(new NotFoundError("Blog not found"));
        }

        // Only allow review for draft posts
        if (blog.status !== BlogStatus.DRAFT) {
          return next(new ForbiddenError("Only draft blog posts can be reviewed"));
        }

        // Verify ownership
        if (blog.author !== userId) {
          return next(new ForbiddenError("You can only review your own blog posts"));
        }
      }

      // Use blog data or provided data
      const reviewTitle = title || blog?.title || "";
      const reviewContent = content || blog?.content || "";
      const reviewExcerpt = excerpt !== undefined ? excerpt : blog?.excerpt;
      const reviewCategory = category || blog?.category;

      if (!reviewTitle || !reviewContent) {
        return next(new BadRequestError("Title and content are required"));
      }

      const reviewResult = await this.blogReviewService.reviewBlog(
        reviewTitle,
        reviewContent,
        reviewExcerpt,
        reviewCategory
      );

      sendSuccess(res, "Blog review completed", reviewResult);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Apply review suggestions to a blog post
   */
  async applyReview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return next(new BadRequestError("User not authenticated"));
      }

      const { blogId } = req.params;
      const { suggestions, improved_content, improved_title, improved_excerpt } = req.body;

      if (!blogId) {
        return next(new BadRequestError("Blog ID is required"));
      }

      const siteId = req.user?.currentSiteId;
      if (!siteId) {
        return next(new BadRequestError("Site context is required"));
      }

      const blog = await this.blogService.getBlogById(blogId, siteId, userId);
      if (!blog) {
        return next(new NotFoundError("Blog not found"));
      }

      // Only allow applying review to draft posts
      if (blog.status !== BlogStatus.DRAFT) {
        return next(new ForbiddenError("Only draft blog posts can be updated with review suggestions"));
      }

      // Verify ownership
      if (blog.author !== userId) {
        return next(new ForbiddenError("You can only update your own blog posts"));
      }

      // Save current version to history before applying changes
      const currentVersion = (blog.version_history?.length || 0) + 1;
      const versionHistory = blog.version_history || [];
      
      versionHistory.push({
        version: currentVersion,
        content: blog.content,
        title: blog.title,
        excerpt: blog.excerpt,
        created_at: new Date(),
      });

      // Apply improvements
      const updateData: any = {
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
  }

  /**
   * Restore a previous version of a blog post
   */
  async restoreVersion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return next(new BadRequestError("User not authenticated"));
      }

      const { blogId, version } = req.params;
      const versionNumber = parseInt(version, 10);

      if (!blogId || isNaN(versionNumber)) {
        return next(new BadRequestError("Blog ID and valid version number are required"));
      }

      const siteId = req.user?.currentSiteId;
      if (!siteId) {
        return next(new BadRequestError("Site context is required"));
      }

      const blog = await this.blogService.getBlogById(blogId, siteId, userId);
      if (!blog) {
        return next(new NotFoundError("Blog not found"));
      }

      // Verify ownership
      if (blog.author !== userId) {
        return next(new ForbiddenError("You can only restore versions of your own blog posts"));
      }

      const versionHistory = blog.version_history || [];
      const targetVersion = versionHistory.find((v) => v.version === versionNumber);

      if (!targetVersion) {
        return next(new NotFoundError(`Version ${versionNumber} not found`));
      }

      // Save current version to history before restoring
      const currentVersion = versionHistory.length + 1;
      versionHistory.push({
        version: currentVersion,
        content: blog.content,
        title: blog.title,
        excerpt: blog.excerpt,
        created_at: new Date(),
      });

      // Restore the target version
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
  }
}
