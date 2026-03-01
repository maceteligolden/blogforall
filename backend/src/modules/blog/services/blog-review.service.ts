import { injectable } from "tsyringe";
import { BlogReviewConfig } from "../../../shared/constants/blog-review.constant";
import { logger } from "../../../shared/utils/logger";
import { BadRequestError } from "../../../shared/errors";
import type { ContentBlock } from "../../../shared/schemas/blog.schema";

/** OpenAI-compatible chat endpoint; model is sent in the request body and the router selects the provider. */
const HF_ROUTER_CHAT_URL = "https://router.huggingface.co/v1/chat/completions";

export type SuggestionType =
  | "readability"
  | "seo"
  | "grammar"
  | "structure"
  | "fact-check"
  | "style"
  | "engagement"
  | "other";

export type SuggestionTarget = "title" | "excerpt" | "content";

export interface ReviewSuggestion {
  id?: string;
  type: SuggestionType;
  priority: "critical" | "important" | "nice-to-have";
  line?: number;
  section?: string;
  /** For in-context placement: title, excerpt, or content (block) */
  target?: SuggestionTarget;
  /** Block id when target is content and content_blocks were sent */
  blockId?: string;
  /** Zero-based block index when target is content */
  blockIndex?: number;
  /** Character offset within block (optional) */
  startOffset?: number;
  endOffset?: number;
  original: string;
  suggestion: string;
  explanation: string;
}

export interface BlogReviewResult {
  overall_score: number; // 0-100
  scores: {
    readability: number;
    seo: number;
    grammar: number;
    structure: number;
    fact_check: number;
    style: number;
    engagement: number;
  };
  suggestions: ReviewSuggestion[];
  improved_content?: string;
  improved_title?: string;
  improved_excerpt?: string;
  summary: string;
}

@injectable()
export class BlogReviewService {
  constructor() {
    const token = BlogReviewConfig.HUGGINGFACE_API_TOKEN;
    if (!token) {
      logger.warn("HUGGINGFACE_API_TOKEN not set. Blog review will not work.", {}, "BlogReviewService");
    }
  }

  /**
   * Call Hugging Face router chat completions (OpenAI-compatible).
   * We request provider "hf-inference" via model suffix so the router uses your HF token (not e.g. Together AI).
   */
  private async hfChatCompletion(
    model: string,
    messages: { role: string; content: string }[],
    maxTokens: number,
    temperature: number
  ): Promise<string> {
    const token = BlogReviewConfig.HUGGINGFACE_API_TOKEN;
    // Force hf-inference so the request is served by Hugging Face and your HF token is used (router otherwise may send to Together AI etc.).
    const modelWithProvider = model.includes(":") ? model : `${model}:hf-inference`;
    const res = await fetch(HF_ROUTER_CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        model: modelWithProvider,
        messages,
        max_tokens: maxTokens,
        temperature,
      }),
    });
    if (!res.ok) {
      const contentType = res.headers.get("Content-Type");
      let body: unknown;
      try {
        body = contentType?.includes("application/json") ? await res.json() : await res.text();
      } catch {
        body = "";
      }
      const err = new Error(
        typeof body === "object" &&
          body !== null &&
          "error" in (body as object) &&
          typeof (body as { error: unknown }).error === "object" &&
          (body as { error: { message?: string } }).error?.message
          ? (body as { error: { message: string } }).error.message
          : `HTTP ${res.status}`
      ) as Error & { httpResponse?: { status: number; body: unknown } };
      (err as Error & { httpResponse?: { status: number; body: unknown } }).httpResponse = { status: res.status, body };
      throw err;
    }
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content?.trim() ?? "";
    return content;
  }

  /**
   * Review a blog post using AI.
   * When content_blocks is provided, suggestions can include blockIndex/blockId for in-context placement.
   */
  async reviewBlog(
    title: string,
    content: string,
    excerpt?: string,
    category?: string,
    content_blocks?: ContentBlock[]
  ): Promise<BlogReviewResult> {
    if (!BlogReviewConfig.HUGGINGFACE_API_TOKEN) {
      throw new BadRequestError("AI review service is not configured. Please set HUGGINGFACE_API_TOKEN.");
    }

    if (!title || !content) {
      throw new BadRequestError("Title and content are required for review");
    }

    if (content.length > BlogReviewConfig.MAX_CONTENT_LENGTH) {
      throw new BadRequestError(
        `Content is too long. Maximum length is ${BlogReviewConfig.MAX_CONTENT_LENGTH} characters.`
      );
    }

    try {
      // Use HTML from content (or generate from blocks if that was the source)
      const textContent = this.stripHtmlTags(content);
      const wordCount = textContent.split(/\s+/).filter((w) => w.length > 0).length;

      const reviewPrompt = this.createReviewPrompt(title, textContent, excerpt, category, wordCount, content_blocks);

      // Call HF Inference API directly so HUGGINGFACE_API_TOKEN is used (SDK provider mapping often omits hf-inference for this model).
      const reviewText = await this.hfChatCompletion(
        BlogReviewConfig.REVIEW_MODEL,
        [{ role: "user", content: reviewPrompt }],
        2000,
        0.3
      );
      const reviewResult = this.parseReviewResponse(reviewText, content, title, excerpt, content_blocks);

      logger.info(
        "Blog review completed",
        { title, wordCount, overallScore: reviewResult.overall_score },
        "BlogReviewService"
      );

      return reviewResult;
    } catch (error) {
      const err = error as Error & { httpResponse?: { status?: number; body?: unknown } };
      const status = err.httpResponse?.status;
      const body = err.httpResponse?.body as Record<string, unknown> | undefined;
      const bodyError = body?.error;
      const errorMessage =
        typeof bodyError === "string"
          ? bodyError
          : bodyError &&
              typeof bodyError === "object" &&
              "message" in bodyError &&
              typeof (bodyError as { message: unknown }).message === "string"
            ? (bodyError as { message: string }).message
            : typeof body?.message === "string"
              ? body.message
              : undefined;
      const detail = status !== undefined ? (errorMessage ? ` (${status}: ${errorMessage})` : ` (HTTP ${status})`) : "";
      const isTogether = typeof errorMessage === "string" && errorMessage.toLowerCase().includes("together");
      const hint =
        status === 401
          ? isTogether
            ? " The router sent this request to Together AI, which requires its own API key. We request :hf-inference so your HF token is used; if the model is not on hf-inference, try another model or add a Together API key in your HF Inference Provider settings."
            : " Check that HUGGINGFACE_API_TOKEN (or HF_TOKEN) is set in .env, is valid, and has Inference permission at https://huggingface.co/settings/tokens."
          : "";
      logger.error("Failed to review blog", err, { title, status, body }, "BlogReviewService");
      throw new BadRequestError(`Failed to review blog: ${err.message}${detail}.${hint}`);
    }
  }

  /**
   * Strip HTML tags but preserve structure information
   */
  private stripHtmlTags(html: string): string {
    // Replace common HTML elements with text equivalents
    let text = html
      .replace(/<h1[^>]*>/gi, "\n# ")
      .replace(/<h2[^>]*>/gi, "\n## ")
      .replace(/<h3[^>]*>/gi, "\n### ")
      .replace(/<h4[^>]*>/gi, "\n#### ")
      .replace(/<h5[^>]*>/gi, "\n##### ")
      .replace(/<h6[^>]*>/gi, "\n###### ")
      .replace(/<p[^>]*>/gi, "\n")
      .replace(/<br[^>]*>/gi, "\n")
      .replace(/<li[^>]*>/gi, "\n- ")
      .replace(/<[^>]+>/g, "") // Remove all remaining HTML tags
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();

    // Clean up multiple newlines
    text = text.replace(/\n{3,}/g, "\n\n");

    return text;
  }

  /**
   * Build a block list summary for the prompt when content_blocks is provided (for block-aware suggestions).
   */
  private buildBlocksSummary(blocks: ContentBlock[]): string {
    return blocks
      .map((b, i) => {
        const text =
          b.type === "paragraph" || b.type === "heading"
            ? (b.data.text ?? "")
            : b.type === "list"
              ? (b.data.items ?? []).join("\n")
              : b.type === "image"
                ? `[Image: ${b.data.caption ?? "no caption"}]`
                : b.type === "blockquote"
                  ? (b.data.text ?? "")
                  : b.type === "code"
                    ? (b.data.text ?? "")
                    : "";
        return `Block ${i} (id: ${b.id}, type: ${b.type}): ${text.slice(0, 500)}${text.length > 500 ? "..." : ""}`;
      })
      .join("\n\n");
  }

  /**
   * Create comprehensive review prompt (with optional block list for block-aware suggestions and engagement score).
   */
  private createReviewPrompt(
    title: string,
    content: string,
    excerpt?: string,
    category?: string,
    wordCount?: number,
    content_blocks?: ContentBlock[]
  ): string {
    const blocksSection =
      content_blocks && content_blocks.length > 0
        ? `
CONTENT AS BLOCKS (use block_index 0-based for suggestions that apply to content):
${this.buildBlocksSummary(content_blocks)}

FLAT CONTENT (for reference):
`
        : "";

    const suggestionFormat =
      content_blocks && content_blocks.length > 0
        ? `{
      "type": "readability" | "seo" | "grammar" | "structure" | "fact-check" | "style" | "engagement" | "other",
      "priority": "critical" | "important" | "nice-to-have",
      "target": "title" | "excerpt" | "content",
      "block_index": <optional, 0-based index when target is content>,
      "block_id": "<optional, block id when target is content>",
      "line": <optional>,
      "section": <optional>,
      "original": "<exact original text>",
      "suggestion": "<improved text>",
      "explanation": "<why this change improves the blog>"
    }`
        : `{
      "type": "readability" | "seo" | "grammar" | "structure" | "fact-check" | "style" | "engagement" | "other",
      "priority": "critical" | "important" | "nice-to-have",
      "line": <optional>,
      "section": <optional>,
      "original": "<original text>",
      "suggestion": "<improved text>",
      "explanation": "<why this change improves the blog>"
    }`;

    return `
You are a senior editorial reviewer and SEO evaluator. 
Analyze the provided blog post quickly but rigorously. 
Focus on clarity, coherence, SEO fundamentals, structural integrity, 
and audience alignment. Do not invent facts. Penalize meaningless, contradictory, 
or AI-gibberish content. Infer the intended blog type, audience, and goal before scoring,
 and use that inference as the benchmark for tone, grammar, structure, and engagement evaluation.
BLOG POST DETAILS:
Title: ${title}
${excerpt ? `Excerpt: ${excerpt}` : ""}
${category ? `Category: ${category}` : ""}
${wordCount ? `Word Count: ${wordCount}` : ""}
${blocksSection}
CONTENT:
${content}
FAST REVIEW RULES: 1) Infer intent: identify blog type (tutorial,
opinion, SEO post, technical guide, etc.), target audience, and primary goal. 2) 
Coherence check: if content contains gibberish, filler, unclear logic, contradiction
or meaningless sentences, cap readability, structure, engagement, and fact_check at 40 or below. 3)
SEO quick checks: title 50–60 characters; excerpt 150–160 characters; clear 
primary keyword present in title and early content; logical heading hierarchy
 (single H1, structured H2/H3); no keyword stuffing; content depth appropriate for 
 topic; matches likely search intent (informational, transactional, etc.). 
 4) Structure check: clear introduction, logical section flow, 
 scannable paragraphs, conclusion or takeaway present. 
 5) Grammar check: spelling, punctuation, tense consistency, 
 subject-verb agreement, sentence clarity. 
 6) Style and engagement: tone consistent with inferred audience; clear value;
  strong opening; avoids fluff; actionable or insightful where appropriate.
  SCORING: Use integers 0–100 only. Be realistic and avoid inflated scores. If content is thin, incoherent, or poorly structured, scores should reflect that. OUTPUT RULES: Return ONLY valid JSON. No markdown. No commentary outside JSON. No trailing commas. improved_content must be a concise but fully rewritten, publication-ready version that preserves the original topic and intent, improves clarity and SEO naturally, removes fluff, adds clean heading structure (one H1 only), and aligns with inferred audience and goal.
Respond with ONLY valid JSON in this exact format:
{
  "overall_score": <number 0-100>,
  "scores": {
    "readability": <number 0-100>,
    "seo": <number 0-100>,
    "grammar": <number 0-100>,
    "structure": <number 0-100>,
    "fact_check": <number 0-100>,
    "style": <number 0-100>,
    "engagement": <number 0-100>
  },
  "suggestions": [
    ${suggestionFormat}
  ],
  "improved_content": "<complete improved version of the content>",
  "improved_title": "<optimized title if needed, otherwise original>",
  "improved_excerpt": "<optimized excerpt if needed, otherwise original>",
  "summary": "<concise evaluation summary>"
}
Return ONLY valid JSON, no markdown or extra text.`;
  }

  /**
   * Parse review response from AI model; normalise suggestions with id, target, blockId, blockIndex.
   */
  private parseReviewResponse(
    reviewText: string,
    originalContent: string,
    originalTitle: string,
    originalExcerpt?: string,
    content_blocks?: ContentBlock[]
  ): BlogReviewResult {
    try {
      let jsonText = reviewText.trim();
      jsonText = jsonText
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
      const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonText = jsonMatch[0];
      }

      const parsed = JSON.parse(jsonText) as Record<string, unknown>;
      const rawSuggestions = (parsed.suggestions as Record<string, unknown>[]) ?? [];

      const suggestions: ReviewSuggestion[] = rawSuggestions.map((s, index) => {
        const sug: ReviewSuggestion = {
          id: String(index),
          type: (s.type as SuggestionType) ?? "other",
          priority: (s.priority as ReviewSuggestion["priority"]) ?? "nice-to-have",
          original: String(s.original ?? ""),
          suggestion: String(s.suggestion ?? ""),
          explanation: String(s.explanation ?? ""),
        };
        if (s.line != null) sug.line = Number(s.line);
        if (s.section != null) sug.section = String(s.section);
        if (s.target != null) sug.target = s.target as SuggestionTarget;
        if (s.block_index != null) {
          sug.blockIndex = Number(s.block_index);
          if (content_blocks?.[sug.blockIndex]) {
            sug.blockId = content_blocks[sug.blockIndex].id;
          }
        }
        if (s.block_id != null) sug.blockId = String(s.block_id);
        if (s.start_offset != null) sug.startOffset = Number(s.start_offset);
        if (s.end_offset != null) sug.endOffset = Number(s.end_offset);
        return sug;
      });

      const scores = (parsed.scores as Record<string, number>) ?? {};
      const result: BlogReviewResult = {
        overall_score: Number(parsed.overall_score) || 70,
        scores: {
          readability: scores.readability ?? 70,
          seo: scores.seo ?? 70,
          grammar: scores.grammar ?? 70,
          structure: scores.structure ?? 70,
          fact_check: scores.fact_check ?? 70,
          style: scores.style ?? 70,
          engagement: scores.engagement ?? 70,
        },
        suggestions,
        improved_content: (parsed.improved_content as string) || originalContent,
        improved_title: (parsed.improved_title as string) || originalTitle,
        improved_excerpt: (parsed.improved_excerpt as string) ?? originalExcerpt,
        summary: (parsed.summary as string) || "Review completed. Please check suggestions for improvements.",
      };

      return result;
    } catch (error) {
      logger.error(
        "Failed to parse review response",
        error as Error,
        { reviewText: reviewText.substring(0, 200) },
        "BlogReviewService"
      );
      return {
        overall_score: 70,
        scores: {
          readability: 70,
          seo: 70,
          grammar: 70,
          structure: 70,
          fact_check: 70,
          style: 70,
          engagement: 70,
        },
        suggestions: [],
        improved_content: originalContent,
        improved_title: originalTitle,
        improved_excerpt: originalExcerpt,
        summary: "Review completed with basic analysis. AI response parsing encountered an issue.",
      };
    }
  }
}
