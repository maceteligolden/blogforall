import { randomUUID } from "crypto";
import { injectable } from "tsyringe";
import {
  contentStrategyArtifactSchema,
  type ContentStrategyArtifact,
} from "../../contracts/content-strategy";
import {
  strategyDefaultsForFormat,
  type PostFormat,
} from "../../contracts/post-format";

export type ContentStrategyInput = {
  topic: string;
  user_notes?: string;
  post_format?: PostFormat;
  workspace_hints?: {
    business_type?: string;
    target_audience?: string[];
    business_goals?: string[];
    brand_voice?: string;
  };
  /** Injected structured result (tests / future LLM adapter). */
  llm_artifact?: Partial<ContentStrategyArtifact>;
};

/**
 * Content Strategy skill (doc 06 §3.2) — one structured output; no Research/Writing.
 * M2: deterministic structured builder (LLM `strategy.propose.v1` can replace later).
 */
@injectable()
export class ContentStrategyService {
  propose(input: ContentStrategyInput): ContentStrategyArtifact {
    const topic = input.topic.trim();
    if (!topic) throw new Error("Strategy requires a topic.");

    const audience =
      input.workspace_hints?.target_audience?.[0] ??
      input.llm_artifact?.target_audience ??
      "target readers interested in this topic";
    const objective =
      input.workspace_hints?.business_goals?.[0] ??
      input.llm_artifact?.business_objective ??
      `Build topical authority around ${topic}`;

    const genre = strategyDefaultsForFormat(topic, audience, input.post_format);

    const base: ContentStrategyArtifact = {
      version: 1,
      id: `strat_${randomUUID()}`,
      topic,
      business_objective: objective,
      target_audience: audience,
      search_intent: "informational",
      keyword_clusters: genre.keyword_clusters,
      content_angle: input.llm_artifact?.content_angle ?? genre.content_angle,
      funnel_stage: "awareness",
      topical_authority_opportunities: genre.topical_authority_opportunities,
      cta: input.llm_artifact?.cta ?? genre.cta,
      content_structure: input.llm_artifact?.content_structure ?? genre.content_structure,
      notes: input.user_notes,
    };

    return contentStrategyArtifactSchema.parse({
      ...base,
      ...input.llm_artifact,
      version: 1,
      id: input.llm_artifact?.id ?? base.id,
      topic,
      // Prefer explicit genre defaults when llm_artifact omitted those fields.
      content_angle: input.llm_artifact?.content_angle ?? base.content_angle,
      content_structure: input.llm_artifact?.content_structure ?? base.content_structure,
      keyword_clusters: input.llm_artifact?.keyword_clusters ?? base.keyword_clusters,
      topical_authority_opportunities:
        input.llm_artifact?.topical_authority_opportunities ??
        base.topical_authority_opportunities,
      cta: input.llm_artifact?.cta ?? base.cta,
    });
  }
}
