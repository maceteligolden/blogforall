import { injectable } from "tsyringe";
import { z } from "zod";
import { HumanMessage } from "@langchain/core/messages";
import { createChatOpenAI } from "../../../shared/ai/create-chat-openai";
import { BlogAiConfig } from "../../../shared/constants/blog-generation.constant";
import { BadRequestError } from "../../../shared/errors";
import { logger } from "../../../shared/utils/logger";
import { CampaignService } from "../../campaign/services/campaign.service";
import { WorkspaceMemoryRepository } from "../../orchestrator/repositories/workspace-memory.repository";
import { BusinessKnowledgeService } from "../../strategic-intelligence/services/business-knowledge.service";
import { TavilySearchService } from "../ai/tavily-search.service";

export const INTERACTIVE_POST_TYPES = [
  "article",
  "tutorial",
  "how_to",
  "listicle",
  "opinion",
  "case_study",
] as const;

export type InteractivePostType = (typeof INTERACTIVE_POST_TYPES)[number];

export type TopicSuggestion = {
  id: string;
  title: string;
  about: string;
  campaign_id?: string;
  campaign_name?: string;
  campaign_support: string;
  keywords: string[];
  post_type: InteractivePostType;
};

export type PostEnrichment = {
  links?: string[];
  example_urls?: string[];
  personal_notes?: string;
  must_include?: string;
  must_avoid?: string;
  target_audience?: string;
  cta?: string;
  tone?: string;
  length_preset?: "short" | "medium" | "long";
  word_count?: number;
};

export type OutlineSection = {
  id: string;
  heading: string;
  intent: string;
};

export type PostOutline = {
  working_title: string;
  thesis: string;
  sections: OutlineSection[];
  keyword_notes: string;
  campaign_tie_in: string;
  post_type: InteractivePostType;
  keywords: string[];
  campaign_id?: string;
};

const TopicListSchema = z.object({
  topics: z
    .array(
      z.object({
        title: z.string(),
        about: z.string(),
        campaign_id: z.string().nullable(),
        campaign_name: z.string().nullable(),
        campaign_support: z.string(),
        keywords: z.array(z.string()).min(1).max(8),
        post_type: z.enum(INTERACTIVE_POST_TYPES),
      })
    )
    .min(3)
    .max(8),
});

const OutlineSchema = z.object({
  working_title: z.string(),
  thesis: z.string(),
  sections: z
    .array(
      z.object({
        heading: z.string(),
        intent: z.string(),
      })
    )
    .min(3)
    .max(10),
  keyword_notes: z.string(),
  campaign_tie_in: z.string(),
});

function lengthPresetToWordCount(preset: "short" | "medium" | "long" | undefined): number | undefined {
  if (!preset) return undefined;
  if (preset === "short") return 800;
  if (preset === "medium") return 1500;
  return 2500;
}

@injectable()
export class InteractivePostGenerationService {
  constructor(
    private readonly tavily: TavilySearchService,
    private readonly campaignService: CampaignService,
    private readonly workspaceMemory: WorkspaceMemoryRepository,
    private readonly businessKnowledge: BusinessKnowledgeService
  ) {}

  assertConfigured(): void {
    if (!BlogAiConfig.openaiApiKey) {
      throw new BadRequestError(
        "AI post generation is not configured. Set OPENAI_API_KEY or BLOG_AI_OPENAI_API_KEY in the server environment."
      );
    }
  }

  async suggestTopics(input: {
    siteId: string;
    userId: string;
    seed_intent?: string;
    campaign_id?: string;
    count?: number;
  }): Promise<{ topics: TopicSuggestion[]; business_summary: string }> {
    this.assertConfigured();
    const count = Math.min(Math.max(input.count ?? 6, 3), 8);
    const { summary, campaigns } = await this.loadBusinessContext(input.siteId, input.userId);

    const filteredCampaigns = input.campaign_id
      ? campaigns.filter((c) => c.id === input.campaign_id)
      : campaigns;

    const campaignLines = (filteredCampaigns.length ? filteredCampaigns : campaigns)
      .slice(0, 8)
      .map(
        (c) =>
          `- id=${c.id} name="${c.name}" goal="${c.goal}" topics=${(c.primary_topics || []).slice(0, 6).join("; ")}`
      )
      .join("\n");

    const researchQuery = [
      summary.business_type,
      summary.target_audience,
      input.seed_intent,
      filteredCampaigns[0]?.name,
      "blog post ideas",
    ]
      .filter(Boolean)
      .join(" ");

    const notes = await this.tavily.search(researchQuery).catch(() => []);
    const researchBlock = notes
      .slice(0, 8)
      .map((n, i) => `${i + 1}. ${n.title}: ${n.snippet.slice(0, 280)}`)
      .join("\n");

    const chat = createChatOpenAI({
      apiKey: BlogAiConfig.openaiApiKey,
      model: BlogAiConfig.chatModel,
      timeout: BlogAiConfig.API_TIMEOUT,
      temperature: 0.55,
    }).withStructuredOutput(TopicListSchema);

    const prompt = `You suggest blog/post topics for a business. Return ${count} strong ideas.

BUSINESS CONTEXT:
${summary.text}

CAMPAIGNS (prefer aligning topics; use campaign_id when relevant, else null for evergreen):
${campaignLines || "- none"}

USER SEED INTENT (optional): ${input.seed_intent?.trim() || "(none — invent useful topics)"}

WEB RESEARCH SNIPPETS:
${researchBlock || "(no research available — rely on business context)"}

Rules:
- Each topic needs a clear title, what the post is about, how it supports a campaign (or evergreen authority), 3–6 keywords, and post_type.
- post_type must be one of: ${INTERACTIVE_POST_TYPES.join(", ")}
- Prefer campaign-aligned ideas when campaigns exist.
- Make topics specific and publishable, not vague.`;

    const out = await chat.invoke([new HumanMessage(prompt)]);
    const topics: TopicSuggestion[] = out.topics.slice(0, count).map((t, i) => ({
      id: `topic_${Date.now()}_${i}`,
      title: t.title,
      about: t.about,
      campaign_id: t.campaign_id || undefined,
      campaign_name: t.campaign_name || undefined,
      campaign_support: t.campaign_support,
      keywords: t.keywords.slice(0, 8),
      post_type: t.post_type,
    }));

    logger.info(
      "Suggested interactive post topics",
      { siteId: input.siteId, count: topics.length },
      "InteractivePostGenerationService"
    );

    return { topics, business_summary: summary.text.slice(0, 500) };
  }

  async buildOutline(input: {
    siteId: string;
    userId: string;
    topic: TopicSuggestion;
    enrichment?: PostEnrichment;
  }): Promise<PostOutline> {
    this.assertConfigured();
    const { summary } = await this.loadBusinessContext(input.siteId, input.userId);
    const enrichment = input.enrichment ?? {};
    const urls = [...(enrichment.links ?? []), ...(enrichment.example_urls ?? [])].filter(Boolean).slice(0, 5);

    const [searchNotes, extracted] = await Promise.all([
      this.tavily.searchMultiQuery(input.topic.title, { minSources: 3, maxSources: 10 }),
      urls.length ? this.tavily.extract(urls) : Promise.resolve([]),
    ]);

    const researchBlock = [
      ...searchNotes.slice(0, 8).map((n, i) => `Search ${i + 1}. ${n.title}: ${n.snippet.slice(0, 300)}`),
      ...extracted.map(
        (e, i) => `Link ${i + 1}. ${e.title || e.url}: ${e.text.slice(0, 800)}`
      ),
    ].join("\n\n");

    const chat = createChatOpenAI({
      apiKey: BlogAiConfig.openaiApiKey,
      model: BlogAiConfig.chatModel,
      timeout: BlogAiConfig.API_TIMEOUT,
      temperature: 0.35,
    }).withStructuredOutput(OutlineSchema);

    const prompt = `Create a publishable blog post outline the user can edit before drafting.

TOPIC:
Title: ${input.topic.title}
About: ${input.topic.about}
Post type: ${input.topic.post_type}
Keywords: ${input.topic.keywords.join(", ")}
Campaign support: ${input.topic.campaign_support}

BUSINESS CONTEXT:
${summary.text}

USER ENRICHMENT:
Notes: ${enrichment.personal_notes || "(none)"}
Must include: ${enrichment.must_include || "(none)"}
Must avoid: ${enrichment.must_avoid || "(none)"}
Audience override: ${enrichment.target_audience || "(use business audience)"}
CTA: ${enrichment.cta || "(optional)"}
Tone: ${enrichment.tone || "(default)"}

RESEARCH:
${researchBlock || "(limited research)"}

Return working_title, thesis, 4–8 sections with heading + intent (what the section will accomplish), keyword_notes, and campaign_tie_in.`;

    const out = await chat.invoke([new HumanMessage(prompt)]);
    return {
      working_title: out.working_title,
      thesis: out.thesis,
      sections: out.sections.map((s, i) => ({
        id: `sec_${i + 1}`,
        heading: s.heading,
        intent: s.intent,
      })),
      keyword_notes: out.keyword_notes,
      campaign_tie_in: out.campaign_tie_in,
      post_type: input.topic.post_type,
      keywords: input.topic.keywords,
      campaign_id: input.topic.campaign_id,
    };
  }

  buildContextPack(outline: PostOutline, enrichment?: PostEnrichment): string {
    const e = enrichment ?? {};
    const sections = outline.sections
      .map((s, i) => `${i + 1}. ${s.heading}: ${s.intent}`)
      .join("\n");
    return [
      `APPROVED OUTLINE — follow closely.`,
      `Title: ${outline.working_title}`,
      `Thesis: ${outline.thesis}`,
      `Post type: ${outline.post_type}`,
      `Keywords: ${outline.keywords.join(", ")}`,
      `Keyword notes: ${outline.keyword_notes}`,
      `Campaign tie-in: ${outline.campaign_tie_in}`,
      `Sections:\n${sections}`,
      e.personal_notes ? `Author notes: ${e.personal_notes}` : "",
      e.must_include ? `Must include: ${e.must_include}` : "",
      e.must_avoid ? `Must avoid: ${e.must_avoid}` : "",
      e.cta ? `CTA: ${e.cta}` : "",
      e.links?.length ? `Source links: ${e.links.join(", ")}` : "",
      e.example_urls?.length ? `Example/reference URLs: ${e.example_urls.join(", ")}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  resolveWordCount(enrichment?: PostEnrichment): number | undefined {
    return enrichment?.word_count ?? lengthPresetToWordCount(enrichment?.length_preset);
  }

  private async loadBusinessContext(siteId: string, userId: string) {
    const [memory, beliefs, campaigns] = await Promise.all([
      this.workspaceMemory.findBySiteId(siteId),
      this.businessKnowledge.listBeliefs(siteId).catch(() => []),
      this.campaignService.getCampaigns(userId, siteId).catch(() => []),
    ]);

    const beliefLines = beliefs
      .slice(0, 20)
      .map((b) => `- ${b.canonical_key}: ${String(b.value_text || "").slice(0, 200)}`)
      .join("\n");

    const strategic = memory?.strategic;
    const business_type = strategic?.business_type || "";
    const target_audience = Array.isArray(strategic?.target_audience)
      ? strategic!.target_audience.join(", ")
      : "";
    const brand_voice = strategic?.brand_voice || "";
    const goals = Array.isArray(strategic?.business_goals) ? strategic!.business_goals.join("; ") : "";

    const text = [
      `Business type: ${business_type || "unknown"}`,
      `Audience: ${target_audience || "general"}`,
      `Brand voice: ${brand_voice || "professional"}`,
      `Goals: ${goals || "grow authority"}`,
      beliefLines ? `Knowledge beliefs:\n${beliefLines}` : "",
      memory?.memory_summary ? `Memory summary: ${memory.memory_summary}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    return {
      summary: { text, business_type, target_audience, brand_voice },
      campaigns: campaigns.map((c) => ({
        id: String(c._id),
        name: c.name || "Campaign",
        goal: c.goal || c.description || "",
        primary_topics: Array.isArray((c as { primary_topics?: string[] }).primary_topics)
          ? (c as { primary_topics?: string[] }).primary_topics || []
          : [],
      })),
    };
  }
}
