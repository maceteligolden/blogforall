import type { ChatOpenAI } from "@langchain/openai";
import { HumanMessage } from "@langchain/core/messages";
import { logger } from "../../../shared/utils/logger";
import type { ContentBlock } from "../../../shared/schemas/blog.schema";

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
  target?: SuggestionTarget;
  blockId?: string;
  blockIndex?: number;
  startOffset?: number;
  endOffset?: number;
  original: string;
  suggestion: string;
  explanation: string;
}

export interface BlogReviewResult {
  overall_score: number;
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

export function stripHtmlTags(html: string): string {
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
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
  text = text.replace(/\n{3,}/g, "\n\n");
  return text;
}

function buildBlocksSummary(blocks: ContentBlock[]): string {
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

export function buildReviewUserPrompt(
  title: string,
  content: string,
  excerpt?: string,
  category?: string,
  wordCount?: number,
  content_blocks?: ContentBlock[],
  researchContext?: string
): string {
  const blocksSection =
    content_blocks && content_blocks.length > 0
      ? `
CONTENT AS BLOCKS (use block_index 0-based for suggestions that apply to content):
${buildBlocksSummary(content_blocks)}

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

  const researchBlock =
    researchContext && researchContext.trim().length > 0
      ? `
WEB RESEARCH SNIPPETS (use only to judge factual alignment; do not invent new facts beyond these URLs):
${researchContext}
`
      : "";

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
${researchBlock}
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

export function parseReviewResponse(
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
      "blog-review.runner"
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

export async function runBlogReviewWithChat(
  chat: ChatOpenAI,
  title: string,
  content: string,
  excerpt?: string,
  category?: string,
  content_blocks?: ContentBlock[],
  researchNotes?: { url: string; title: string; snippet: string }[],
  signal?: AbortSignal
): Promise<BlogReviewResult> {
  const textContent = stripHtmlTags(content);
  const wordCount = textContent.split(/\s+/).filter((w) => w.length > 0).length;
  const researchContext =
    researchNotes && researchNotes.length > 0
      ? researchNotes.map((n, i) => `[${i + 1}] ${n.title} (${n.url})\n${n.snippet}`).join("\n\n")
      : undefined;
  const reviewPrompt = buildReviewUserPrompt(
    title,
    textContent,
    excerpt,
    category,
    wordCount,
    content_blocks,
    researchContext
  );
  const response = await chat.invoke([new HumanMessage(reviewPrompt)], { signal });
  const raw =
    typeof response.content === "string"
      ? response.content
      : Array.isArray(response.content)
        ? response.content.map((c) => ("text" in c ? String(c.text) : "")).join("")
        : String(response.content ?? "");
  return parseReviewResponse(raw, content, title, excerpt, content_blocks);
}
