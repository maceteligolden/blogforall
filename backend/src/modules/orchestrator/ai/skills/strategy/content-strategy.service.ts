import { randomUUID } from "crypto";
import { injectable } from "tsyringe";
import {
  contentStrategyArtifactSchema,
  type ContentStrategyArtifact,
} from "../../contracts/content-strategy";

export type ContentStrategyInput = {
  topic: string;
  user_notes?: string;
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

    const base: ContentStrategyArtifact = {
      version: 1,
      id: `strat_${randomUUID()}`,
      topic,
      business_objective: objective,
      target_audience: audience,
      search_intent: "informational",
      keyword_clusters: [
        [topic, `${topic} guide`, `${topic} best practices`],
        [`how to ${topic}`, `${topic} examples`],
      ],
      content_angle:
        input.llm_artifact?.content_angle ??
        `Practical, evidence-backed take on ${topic} for ${audience}`,
      funnel_stage: "awareness",
      topical_authority_opportunities: [
        `Define core concepts for ${topic}`,
        `Compare common approaches`,
        `Share implementation pitfalls`,
      ],
      cta: input.llm_artifact?.cta ?? "Invite readers to apply one next step or book a consult.",
      content_structure: input.llm_artifact?.content_structure ?? [
        "Hook + problem framing",
        "Key concepts / definitions",
        "Practical steps or framework",
        "Examples and pitfalls",
        "CTA / next action",
      ],
      notes: input.user_notes,
    };

    return contentStrategyArtifactSchema.parse({
      ...base,
      ...input.llm_artifact,
      version: 1,
      id: input.llm_artifact?.id ?? base.id,
      topic,
    });
  }
}
