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
import type { ResearchPackage, ResearchPackageSummary } from "../../contracts/research-package";
import { ArtifactStoreService } from "../../memory/artifact-store.service";
import { buildResearchPackageFromNotes } from "./build-package";

export type ResearchLiteInput = {
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
};

export type ResearchLiteResult = {
  package: ResearchPackage;
  summary: ResearchPackageSummary;
  provenance_errors: string[];
  persisted?: boolean;
  research_brief: ResearchBrief;
  needs_clarification: boolean;
};

/**
 * Research skill — lite depth (doc 16).
 * Owns web search; Writing must never call Tavily.
 * Personal/linkedin formats skip web search and return a conversation-constraint package.
 */
@injectable()
export class ResearchLiteService {
  constructor(
    private readonly tavily: TavilySearchService,
    private readonly artifacts: ArtifactStoreService
  ) {}

  async run(input: ResearchLiteInput): Promise<ResearchLiteResult> {
    const topic = input.topic.trim();
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
      allow_guess: input.allow_guess ?? true,
    });

    const needs_clarification = research_brief.ambiguity.is_ambiguous && !narrativeOnly;
    if (needs_clarification) {
      const built = buildResearchPackageFromNotes({
        workspace_id: input.workspace_id,
        topic,
        depth: "lite",
        audience: input.audience,
        search_intent: input.search_intent,
        notes: [],
        max_sources: MVP_LOCKS.researchSourcesLiteMax,
        post_format: input.post_format,
        research_brief,
      });
      return { ...built, research_brief, needs_clarification: true, persisted: false };
    }

    const queries = narrativeOnly || research_brief.scope.kind === "brand_owned" ? [] : research_brief.search_queries;
    const rawNotes =
      narrativeOnly || !queries.length
        ? []
        : await this.tavily.search(queries[0]!, input.signal);

    const routed = routeResearchNotes(
      rawNotes.map((n) => ({
        url: n.url,
        title: n.title,
        snippet: n.snippet,
        source: "web" as const,
      })),
      style,
      { maxKeep: MVP_LOCKS.researchSourcesLiteMax, mustInclude: input.must_include, personalNotes: input.personal_notes }
    );

    // Extract top URLs for denser notes
    const extractUrls = routed.map((n) => n.url).filter((u): u is string => Boolean(u && /^https?:/i.test(u))).slice(0, 3);
    const extracted = extractUrls.length ? await this.tavily.extract(extractUrls, input.signal) : [];
    const byUrl = new Map(extracted.map((e) => [e.url, e]));

    const notes = routed.map((n, i) => {
      const ex = n.url ? byUrl.get(n.url) : undefined;
      return {
        url: n.url || "",
        title: n.title,
        snippet: ex?.text?.slice(0, 1200) || n.snippet,
        claim: (ex?.text || n.snippet).slice(0, 400),
        question_id: `q${(i % Math.max(1, research_brief.must_answer.length)) + 1}`,
        source_kind: (ex ? "extract" : n.source === "user" ? "user" : "web") as "web" | "extract" | "user",
      };
    });

    const built = buildResearchPackageFromNotes({
      workspace_id: input.workspace_id,
      topic,
      depth: "lite",
      audience: input.audience,
      search_intent: input.search_intent,
      notes,
      max_sources: MVP_LOCKS.researchSourcesLiteMax,
      post_format: input.post_format,
      research_brief,
    });

    let persisted = false;
    if (input.persist !== false && !needs_clarification) {
      await this.artifacts.saveResearchPackage(built.package, {
        created_by: input.created_by,
        thread_id: input.thread_id,
      });
      persisted = true;
    }

    return { ...built, persisted, research_brief, needs_clarification: false };
  }
}
