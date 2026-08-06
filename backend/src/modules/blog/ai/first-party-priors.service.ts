import { injectable } from "tsyringe";
import { BlogRepository } from "../repositories/blog.repository";
import { CommentRepository } from "../../comment/repositories/comment.repository";
import type { FirstPartyPriors } from "./contracts/research-brief";

function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Builds soft priors from recent published posts when a knowledge base is empty/unavailable.
 * Caps exemplars — does not dump full post bodies into research.
 */
@injectable()
export class FirstPartyPriorsService {
  constructor(
    private readonly blogs: BlogRepository,
    private readonly comments: CommentRepository
  ) {}

  async load(siteId: string, topic?: string): Promise<FirstPartyPriors> {
    if (!siteId) {
      return emptyPriors();
    }

    try {
      const page = await this.blogs.findPublished(siteId, { page: 1, limit: 10 });
      const posts = page.data ?? [];
      if (!posts.length) return emptyPriors();

      const ranked = [...posts].sort((a, b) => {
        const ea = (a.views || 0) + (a.likes || 0) * 5;
        const eb = (b.views || 0) + (b.likes || 0) * 5;
        return eb - ea;
      });

      const exemplars = ranked.slice(0, 3);
      const avoid = posts
        .slice(0, 8)
        .map((p) => p.title?.trim())
        .filter(Boolean) as string[];

      const winning = exemplars
        .filter((p) => (p.views || 0) + (p.likes || 0) > 0)
        .map((p) => `${p.title} (views ${p.views || 0}, likes ${p.likes || 0})`);

      const style_snippets = exemplars.map((p) => {
        const body = stripTags(String(p.content || p.excerpt || "")).slice(0, 400);
        return `${p.title}: ${body}`;
      });

      const comment_questions: string[] = [];
      for (const p of exemplars.slice(0, 2)) {
        try {
          const thread = await this.comments.findByBlog(String(p._id), { page: 1, limit: 5 });
          for (const c of thread.data ?? []) {
            const text = String((c as { content?: string }).content || "").trim();
            if (text.length > 20 && text.includes("?")) {
              comment_questions.push(text.slice(0, 200));
            } else if (text.length > 40) {
              comment_questions.push(`What do readers mean by: ${text.slice(0, 160)}?`);
            }
          }
        } catch {
          // comments optional
        }
      }

      // Soft topic overlap warning
      if (topic?.trim()) {
        const needle = topic.toLowerCase().split(/\s+/).slice(0, 3).join(" ");
        for (const p of posts) {
          if (p.title?.toLowerCase().includes(needle.split(" ")[0] || "")) {
            if (!avoid.includes(`Already covered angle: ${p.title}`)) {
              avoid.push(`Already covered angle: ${p.title}`);
            }
          }
        }
      }

      return {
        avoid_duplicate_angles: avoid.slice(0, 10),
        style_exemplar_post_ids: exemplars.map((p) => String(p._id)),
        winning_patterns: winning.slice(0, 5),
        style_snippets: style_snippets.slice(0, 3),
        comment_questions: comment_questions.slice(0, 5),
      };
    } catch {
      return emptyPriors();
    }
  }
}

function emptyPriors(): FirstPartyPriors {
  return {
    avoid_duplicate_angles: [],
    style_exemplar_post_ids: [],
    winning_patterns: [],
    style_snippets: [],
    comment_questions: [],
  };
}
