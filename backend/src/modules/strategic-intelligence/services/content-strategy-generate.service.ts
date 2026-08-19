import { z } from "zod";
import { injectable } from "tsyringe";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { env } from "../../../shared/config/env";
import { createChatOpenAI } from "../../../shared/ai/create-chat-openai";
import { logger } from "../../../shared/utils/logger";
import { WebsiteIngestService } from "../../orchestrator/services/website-ingest.service";
import { proposalToMemoryPatch } from "../../orchestrator/utils/website-onboarding.helper";
import { BusinessKnowledgeService } from "./business-knowledge.service";
import {
  coalesceContentStrategyDocument,
  documentFromStrategicMemory,
  ensureContentStrategyCompleteness,
  parseContentStrategyDocument,
  type ContentStrategyDocument,
  type ContentStrategySectionConfidenceMap,
} from "../../../shared/types/content-strategy.document";

/** OpenAI json_schema rejects Zod `.optional()`. Every field here is required. */
const contentStrategyLlmSchema = z.object({
  what_we_are: z.string(),
  what_we_sell: z.string(),
  commercial_goal: z.string(),
  growth_priority: z.string(),
  audience_who: z.string(),
  audience_situation: z.string(),
  audience_jtbd: z.string(),
  beliefs_to_change: z.array(z.string()),
  awareness_stage: z.string(),
  category: z.string(),
  differentiation: z.string(),
  value_proposition: z.string(),
  positioning_statement: z.string(),
  core_message: z.string(),
  supporting_messages: z.array(z.string()),
  editorial_pov: z.string(),
  pillar_names: z.array(z.string()),
  personality: z.string(),
  voice: z.string(),
  tone_range: z.string(),
  writing_principles: z.array(z.string()),
  desired_action: z.string(),
  primary_cta: z.string(),
  secondary_cta: z.string(),
});

@injectable()
export class ContentStrategyGenerateService {
  constructor(
    private readonly websiteIngest: WebsiteIngestService,
    private readonly knowledge: BusinessKnowledgeService
  ) {}

  async ingestWebsiteAndSeedMemory(
    siteId: string,
    userId: string,
    rawUrl: string
  ): Promise<{
    url: string;
    scrapeText: string;
    proposalSummary: string;
    strategic: Record<string, unknown>;
  }> {
    const proposed = await this.websiteIngest.ingestAndPropose(rawUrl);
    if (!proposed) {
      throw new Error("Could not read that website. Check the URL and try again.");
    }

    const patch = proposalToMemoryPatch(proposed.proposal, proposed.url);
    const strategicPatch = {
      ...((patch.strategic as Record<string, unknown>) || {}),
      website_url: proposed.url,
    };
    await this.knowledge.applyStrategicPatch(
      siteId,
      userId,
      {
        strategic: strategicPatch,
        preferences: patch.preferences as Record<string, unknown> | undefined,
        ...(typeof patch.memory_summary === "string" ? { memory_summary: patch.memory_summary } : {}),
      },
      "website_inferred"
    );

    return {
      url: proposed.url,
      scrapeText: proposed.text?.slice(0, 14_000) || proposed.summary,
      proposalSummary: proposed.summary,
      strategic: strategicPatch,
    };
  }

  async mapScrapeToDocument(input: {
    scrapeText: string;
    proposalSummary: string;
    websiteUrl: string;
    workspaceName?: string;
    strategic?: Record<string, unknown>;
  }): Promise<{ document: ContentStrategyDocument; section_confidence: ContentStrategySectionConfidenceMap }> {
    const fallback = this.heuristicDocument(input);
    const apiKey = env.orchestrator.openaiApiKey || env.blogAi.openaiApiKey;
    if (!apiKey) return fallback;

    const chat = createChatOpenAI({
      apiKey,
      model: env.blogAi.chatModel || "gpt-4o-mini",
      timeout: env.orchestrator.API_TIMEOUT,
      temperature: 0.2,
    });
    const structured = chat.withStructuredOutput(contentStrategyLlmSchema);
    try {
      const raw = await structured.invoke([
        new SystemMessage(
          [
            "You write a Content Strategy (editorial constitution) from a company website.",
            "Every string must be a concrete inferred value — never empty.",
            "lists need at least 2 items. pillar_names needs 3–6 short names.",
            "Infer reasonable short values from the site; do not leave fields blank because evidence is thin.",
            "Do not invent pricing, named clients, calendars, or visual brand.",
            "Keep each field to 1–3 sentences or a short list.",
          ].join(" ")
        ),
        new HumanMessage(
          [
            input.workspaceName ? `Workspace: ${input.workspaceName}` : "",
            `Website: ${input.websiteUrl}`,
            input.proposalSummary ? `Extracted profile:\n${input.proposalSummary}` : "",
            `Site text:\n${input.scrapeText.slice(0, 12000)}`,
          ]
            .filter(Boolean)
            .join("\n\n")
        ),
      ]);
      const fromLlm = parseContentStrategyDocument({
        north_star: {
          what_we_are: raw.what_we_are,
          what_we_sell: raw.what_we_sell,
          commercial_goal: raw.commercial_goal,
          growth_priority: raw.growth_priority,
        },
        audience: {
          primary: {
            who: raw.audience_who,
            situation: raw.audience_situation,
            jtbd: raw.audience_jtbd,
            beliefs_to_change: raw.beliefs_to_change,
          },
          awareness_stage: raw.awareness_stage,
        },
        positioning: {
          category: raw.category,
          differentiation: raw.differentiation,
          value_proposition: raw.value_proposition,
          statement: raw.positioning_statement,
        },
        narrative: {
          core_message: raw.core_message,
          supporting_messages: raw.supporting_messages,
          editorial_pov: raw.editorial_pov,
        },
        content_franchise: {
          pillars: raw.pillar_names.map((name) => ({ name, authority_thesis: "", in_scope: [], out_of_scope: [] })),
        },
        voice: {
          personality: raw.personality,
          voice: raw.voice,
          tone_range: raw.tone_range,
          writing_principles: raw.writing_principles,
        },
        conversion: {
          desired_action: raw.desired_action,
          primary_cta: raw.primary_cta,
          secondary_cta: raw.secondary_cta,
        },
      });
      const document = ensureContentStrategyCompleteness(
        coalesceContentStrategyDocument(fromLlm, fallback.document)
      );
      return { document, section_confidence: this.confidenceFor(document, "website") };
    } catch (error) {
      logger.warn(
        "Content strategy LLM mapping failed; using heuristic",
        { error: String(error), url: input.websiteUrl },
        "ContentStrategyGenerateService"
      );
      return fallback;
    }
  }

  private heuristicDocument(input: {
    scrapeText: string;
    proposalSummary: string;
    websiteUrl: string;
    strategic?: Record<string, unknown>;
  }): { document: ContentStrategyDocument; section_confidence: ContentStrategySectionConfidenceMap } {
    const fromMemory = documentFromStrategicMemory({
      ...(input.strategic ?? {}),
      business_description:
        (typeof input.strategic?.business_description === "string" && input.strategic.business_description) ||
        input.proposalSummary.slice(0, 800),
      website_url: input.websiteUrl,
    });
    const snippet = input.scrapeText.replace(/\s+/g, " ").trim().slice(0, 400);
    if (!fromMemory.north_star.what_we_are && snippet) {
      fromMemory.north_star.what_we_are = snippet;
    }
    const document = ensureContentStrategyCompleteness(parseContentStrategyDocument(fromMemory));
    return {
      document,
      section_confidence: this.confidenceFor(document, "inferred"),
    };
  }

  private confidenceFor(
    document: ContentStrategyDocument,
    source: "website" | "inferred"
  ): ContentStrategySectionConfidenceMap {
    return {
      north_star: { confidence: document.north_star.what_we_are ? 0.75 : 0.4, source },
      audience: { confidence: document.audience.primary.who ? 0.7 : 0.4, source },
      positioning: { confidence: document.positioning.statement ? 0.65 : 0.4, source: "inferred" },
      narrative: { confidence: document.narrative.core_message ? 0.65 : 0.4, source: "inferred" },
      content_franchise: {
        confidence: document.content_franchise.pillars.length >= 3 ? 0.7 : 0.45,
        source: "inferred",
      },
      voice: { confidence: document.voice.voice ? 0.7 : 0.4, source },
      jobs_of_content: { confidence: 0.5, source: "inferred" },
      conversion: { confidence: document.conversion.primary_cta ? 0.6 : 0.4, source: "inferred" },
      guardrails: { confidence: 0.55, source: "inferred" },
      measurement: { confidence: document.measurement.content_kpis.length ? 0.55 : 0.35, source: "inferred" },
    };
  }
}
