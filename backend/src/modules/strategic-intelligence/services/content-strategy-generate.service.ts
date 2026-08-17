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
  contentStrategyDocumentSchema,
  documentFromStrategicMemory,
  ensureContentStrategyCompleteness,
  parseContentStrategyDocument,
  type ContentStrategyDocument,
  type ContentStrategySectionConfidenceMap,
} from "../../../shared/types/content-strategy.document";

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
    const structured = chat.withStructuredOutput(contentStrategyDocumentSchema);
    try {
      const raw = await structured.invoke([
        new SystemMessage(
          [
            "You write a Content Strategy (editorial constitution) from a company website.",
            "Every required string field must be a concrete inferred value — never empty strings.",
            "Every required list must have at least 2 items (except competitors if unknown).",
            "Fill ALL sections: north_star, audience (who, situation, jtbd, beliefs_to_change, awareness_stage),",
            "positioning (category, differentiation, value_proposition, statement, competitors if named),",
            "narrative (core_message, supporting_messages, proof_points, claims we can/must not make, editorial_pov),",
            "content_franchise with 3–6 named pillars (name, authority_thesis, in_scope, out_of_scope),",
            "voice (personality, voice, tone_range, writing_principles, words_to_use, words_to_avoid),",
            "jobs_of_content weights summing to ~1, conversion (desired_action, primary_cta, secondary_cta, how_content_supports_offer),",
            "guardrails (always, never, accuracy_bar), measurement (content_kpis, business_outcomes).",
            "Infer reasonable short values from the site; do not leave sections blank because evidence is thin.",
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
      const document = ensureContentStrategyCompleteness(
        coalesceContentStrategyDocument(parseContentStrategyDocument(raw), fallback.document)
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
