import { injectable } from "tsyringe";
import { BlogGenerationGraphService } from "../../../../blog/ai/blog-generation-graph.service";
import type { BlogUserGenerationParams, GeneratedBlogContent, PromptAnalysis } from "../../../../blog/ai/types";
import type { OptimizationPlan } from "../../contracts/content-optimization";
import type { ResearchPackage } from "../../contracts/research-package";
import { assertWritingMayProceed } from "./writing-guards";
import { researchPackageToNotes } from "./package-to-notes";

export type WritingAction = "outline" | "draft" | "revise";

export type WritingSkillInput = {
  action: WritingAction;
  workspace_id: string;
  topic: string;
  prompt?: string;
  research_package_id?: string;
  /** Required for draft/outline on quick_draft / strategist paths. */
  research_package?: ResearchPackage;
  allow_without_package?: boolean;
  feedback?: string;
  optimization_plan?: OptimizationPlan;
  /** Existing draft for revise. */
  draft?: GeneratedBlogContent;
  analysis?: PromptAnalysis;
  userParams?: BlogUserGenerationParams;
  signal?: AbortSignal;
};

export type WritingSkillResult = {
  action: WritingAction;
  research_package_id?: string;
  outline?: { title: string; sections: Array<{ heading: string; summary: string }> };
  draft?: GeneratedBlogContent;
  used_search: false;
  grounded_source_count: number;
};

/**
 * Writing skill (doc 06 §3.4) — consumes Research Package; never searches.
 */
@injectable()
export class WritingSkillService {
  constructor(private readonly blogGraph: BlogGenerationGraphService) {}

  async run(input: WritingSkillInput): Promise<WritingSkillResult> {
    assertWritingMayProceed({
      research_package_id: input.research_package_id ?? input.research_package?.id,
      allow_without_package: input.allow_without_package,
    });

    if (input.action !== "revise" && !input.research_package && !input.allow_without_package) {
      throw new Error("Writing draft/outline requires research_package body for grounding.");
    }

    const notes = input.research_package ? researchPackageToNotes(input.research_package) : [];
    const analysis = input.analysis ?? this.defaultAnalysis(input.topic);
    const prompt = (input.prompt ?? input.topic).trim();
    const packageId = input.research_package_id ?? input.research_package?.id;

    if (input.action === "outline") {
      const outline = await this.blogGraph.outlineFromNotes(
        prompt,
        analysis,
        notes,
        input.userParams,
        input.signal,
      );
      return {
        action: "outline",
        research_package_id: packageId,
        outline,
        used_search: false,
        grounded_source_count: notes.length,
      };
    }

    if (input.action === "revise") {
      if (!input.draft) {
        throw new Error("Writing revise requires an existing draft.");
      }
      const feedback = this.buildReviseFeedback(input);
      const draft = await this.blogGraph.regenerateWithFeedback({
        title: input.draft.title,
        content: input.draft.content,
        excerpt: input.draft.excerpt,
        feedback,
        userParams: input.userParams,
        signal: input.signal,
      });
      return {
        action: "revise",
        research_package_id: packageId,
        draft,
        used_search: false,
        grounded_source_count: notes.length,
      };
    }

    const draft = await this.blogGraph.draftFromNotes(
      prompt,
      analysis,
      notes,
      input.userParams,
      input.signal,
    );
    return {
      action: "draft",
      research_package_id: packageId,
      draft,
      used_search: false,
      grounded_source_count: notes.length,
    };
  }

  private buildReviseFeedback(input: WritingSkillInput): string {
    const parts: string[] = [];
    if (input.feedback?.trim()) parts.push(input.feedback.trim());
    if (input.optimization_plan) {
      parts.push(input.optimization_plan.writing_brief);
      const critical = input.optimization_plan.critical.map((r) => `- [Critical] ${r.message}`);
      const high = input.optimization_plan.high.map((r) => `- [High] ${r.message}`);
      if (critical.length || high.length) {
        parts.push(["Apply these optimization items:", ...critical, ...high].join("\n"));
      }
    }
    if (!parts.length) {
      throw new Error("Writing revise requires feedback or optimization_plan.");
    }
    return parts.join("\n\n");
  }

  private defaultAnalysis(topic: string): PromptAnalysis {
    return {
      topic,
      domain: "general",
      target_audience: "general readers",
      purpose: "inform",
      is_valid: true,
    };
  }
}
