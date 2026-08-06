import { injectable } from "tsyringe";
import { TavilySearchService } from "../../../../blog/ai/tavily-search.service";
import {
  buildResearchBrief,
  type ResearchBrief,
  type ResearchScope,
} from "../../../../blog/ai/contracts/research-brief";
import { resolveStyleProfile } from "../../../../blog/ai/contracts/style-profile";
import { routeResearchNotes } from "../../../../blog/ai/contracts/signal-router";
import type { ContentArchetype } from "../../../../blog/ai/contracts/content-archetype";
import type { FirstPartyPriors } from "../../../../blog/ai/contracts/research-brief";
import { MVP_LOCKS } from "../../contracts/mvp-locks";
import { skipsHowToResearch, type PostFormat } from "../../contracts/post-format";
import {
  needsCoverageRetry,
  type ResearchPackage,
  type ResearchPackageSummary,
} from "../../contracts/research-package";
import type { PhaseListener } from "../../observability/phase-emitter";
import { ArtifactStoreService } from "../../memory/artifact-store.service";
import { buildResearchPackageFromNotes } from "./build-package";

export type ResearchFullInput = {
  workspace_id: string;
  topic: string;
  audience?: string;
  search_intent?: string;
  post_format?: PostFormat;
  content_archetype?: ContentArchetype | string;
  personal_notes?: string;
  must_include?: string;
  clarify_choice?: string;
  resolved_scope?: ResearchScope;
  first_party?: FirstPartyPriors;
  allow_guess?: boolean;
  signal?: AbortSignal;
  persist?: boolean;
  created_by?: string;
  thread_id?: string;
  onPhase?: PhaseListener;
};

export type ResearchFullResult = {
  package: ResearchPackage;
  summary: ResearchPackageSummary;
  provenance_errors: string[];
  coverage_retries: number;
  persisted: boolean;
  research_brief: ResearchBrief;
  needs_clarification: boolean;
};

/**
 * Research skill — full depth with brief, archetype queries, extract, coverage-by-questions.
 */
@injectable()
export class ResearchFullService {
  constructor(
    private readonly tavily: TavilySearchService,
    private readonly artifacts: ArtifactStoreService
  ) {}

  async run(input: ResearchFullInput): Promise<ResearchFullResult> {
    const topic = input.topic.trim();
    const emit = input.onPhase;
    const narrativeOnly = skipsHowToResearch(input.post_format);
    const style = resolveStyleProfile({
      archetype: input.content_archetype,
      audience: input.audience,
      personal_notes: input.personal_notes,
      must_include: input.must_include,
      topic,
      site_id: input.workspace_id,
    });

    const research_brief = buildResearchBrief({
      topic,
      audience: input.audience,
      archetype: input.content_archetype || style.archetype,
      style_profile: style,
      personal_notes: input.personal_notes,
      clarify_choice: input.clarify_choice,
      resolved_scope: input.resolved_scope,
      first_party: input.first_party,
      allow_guess: input.allow_guess ?? false,
    });

    const needs_clarification = research_brief.ambiguity.is_ambiguous && !narrativeOnly;
    if (needs_clarification) {
      emit?.({
        phase: "research_planning",
        message: research_brief.ambiguity.clarifying_question || "Topic needs clarification before research",
        skill_id: "research",
        percent: 5,
        meta: { needs_clarification: true, options: research_brief.ambiguity.options },
      });
      const built = buildResearchPackageFromNotes({
        workspace_id: input.workspace_id,
        topic,
        depth: "full",
        audience: input.audience,
        search_intent: input.search_intent,
        notes: [],
        max_sources: MVP_LOCKS.researchSourcesFullMax,
        post_format: input.post_format,
        research_brief,
      });
      return {
        ...built,
        coverage_retries: 0,
        persisted: false,
        research_brief,
        needs_clarification: true,
      };
    }

    const queries =
      narrativeOnly || research_brief.scope.kind === "brand_owned" ? [] : research_brief.search_queries;

    emit?.({
      phase: "research_planning",
      message: narrativeOnly
        ? "Skipping how-to web research for personal/narrative format"
        : `Planning ${queries.length} scoped research queries`,
      skill_id: "research",
      percent: 10,
      meta: {
        query_count: queries.length,
        post_format: input.post_format,
        scope: research_brief.scope.kind,
        archetype: style.archetype,
      },
    });

    emit?.({
      phase: "research_gathering",
      message: narrativeOnly ? "No web gather for narrative format" : "Gathering sources",
      skill_id: "research",
      percent: 35,
    });
    const raw = narrativeOnly ? [] : await this.searchAll(queries, input.signal);

    const routed = routeResearchNotes(
      raw.map((n) => ({
        url: n.url,
        title: n.title,
        snippet: n.snippet || "",
        source: "web" as const,
      })),
      style,
      {
        maxKeep: MVP_LOCKS.researchSourcesFullMax,
        mustInclude: input.must_include,
        personalNotes: input.personal_notes,
      }
    );

    const extractUrls = routed
      .map((n) => n.url)
      .filter((u): u is string => Boolean(u && /^https?:/i.test(u)))
      .slice(0, 5);
    emit?.({
      phase: "research_structuring",
      message: `Extracting ${extractUrls.length} sources into structured notes`,
      skill_id: "research",
      percent: 55,
    });
    const extracted = extractUrls.length ? await this.tavily.extract(extractUrls, input.signal) : [];
    const byUrl = new Map(extracted.map((e) => [e.url, e]));

    let notes = routed.map((n, i) => {
      const ex = n.url ? byUrl.get(n.url) : undefined;
      const qLen = Math.max(1, research_brief.must_answer.length);
      return {
        url: n.url || "",
        title: n.title,
        snippet: (ex?.text || n.snippet).slice(0, 1500),
        claim: (ex?.text || n.snippet).slice(0, 500),
        question_id: `q${(i % qLen) + 1}`,
        source_kind: (ex ? "extract" : n.source === "user" ? "user" : "web") as "web" | "extract" | "user",
      };
    });

    emit?.({
      phase: "research_structuring",
      message: `Structuring ${notes.length} sources into package`,
      skill_id: "research",
      percent: 65,
      meta: { source_count: notes.length },
    });

    let coverage_retries = 0;
    let built = buildResearchPackageFromNotes({
      workspace_id: input.workspace_id,
      topic,
      depth: "full",
      audience: input.audience,
      search_intent: input.search_intent,
      notes,
      max_sources: MVP_LOCKS.researchSourcesFullMax,
      post_format: input.post_format,
      research_brief,
    });

    if (
      !narrativeOnly &&
      needsCoverageRetry(
        "full",
        built.package.coverage.coverage_score,
        coverage_retries,
        MVP_LOCKS.coverageMin,
        MVP_LOCKS.researchCoverageRetryMax
      )
    ) {
      coverage_retries += 1;
      const missing = built.package.coverage.missing_areas;
      const gapQuestion =
        research_brief.must_answer.find((_, i) => missing.includes(`q${i + 1}`)) ||
        `${topic} overview sources`;
      emit?.({
        phase: "research_gathering",
        message: "Coverage below minimum — targeted retry for unanswered questions",
        skill_id: "research",
        percent: 75,
        meta: { coverage_retries, gapQuestion },
      });
      const extra = await this.tavily.search(gapQuestion.replace(/\?$/, ""), input.signal);
      const seen = new Set(notes.map((n) => n.url));
      for (const n of extra) {
        if (seen.has(n.url)) continue;
        seen.add(n.url);
        notes.push({
          url: n.url,
          title: n.title,
          snippet: n.snippet,
          claim: n.snippet.slice(0, 400),
          question_id: missing[0] || "q1",
          source_kind: "web",
        });
      }
      built = buildResearchPackageFromNotes({
        workspace_id: input.workspace_id,
        topic,
        depth: "full",
        audience: input.audience,
        search_intent: input.search_intent,
        notes,
        max_sources: MVP_LOCKS.researchSourcesFullMax,
        post_format: input.post_format,
        research_brief,
      });
    }

    emit?.({
      phase: "research_packaging",
      message: `Package ready (coverage ${built.summary.coverage_score.toFixed(2)})`,
      skill_id: "research",
      percent: 95,
      meta: {
        coverage_score: built.summary.coverage_score,
        source_count: built.summary.source_count,
        contradiction_count: built.summary.contradiction_count,
        scope: research_brief.scope.kind,
      },
    });

    let persisted = false;
    if (input.persist !== false) {
      await this.artifacts.saveResearchPackage(built.package, {
        created_by: input.created_by,
        thread_id: input.thread_id,
      });
      persisted = true;
    }

    return { ...built, coverage_retries, persisted, research_brief, needs_clarification: false };
  }

  private async searchAll(
    queries: string[],
    signal?: AbortSignal
  ): Promise<Array<{ url: string; title: string; snippet?: string }>> {
    const batches = await Promise.all(queries.map((q) => this.tavily.search(q, signal)));
    const seen = new Set<string>();
    const out: Array<{ url: string; title: string; snippet?: string }> = [];
    for (const batch of batches) {
      for (const n of batch) {
        if (seen.has(n.url)) continue;
        seen.add(n.url);
        out.push(n);
      }
    }
    return out;
  }
}
