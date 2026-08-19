import { randomUUID } from "crypto";
import { AsyncLocalStorage } from "async_hooks";
import { injectable } from "tsyringe";
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { z } from "zod";
import { createChatOpenAI } from "../../../shared/ai/create-chat-openai";
import { env } from "../../../shared/config/env";
import { logger } from "../../../shared/utils/logger";
import { TavilySearchService } from "../../blog/ai/tavily-search.service";
import { ArtifactStoreService } from "../../orchestrator/ai/memory/artifact-store.service";
import { AGENT_MODEL } from "../orchestrator.constants";
import { mapGraphToPackage, packageSummary } from "./research-package.mapper";
import { classifySourceTier, evaluateStopping, hostnameOf, scoreDocument } from "./research.scoring";
import type {
  CampaignTopicSuggestion,
  ResearchBriefState,
  ResearchClaim,
  ResearchCriticNotes,
  ResearchDepth,
  ResearchDocument,
  ResearchFinding,
  ResearchGraphInput,
  ResearchGraphResult,
  ResearchSearchRecord,
  ResearchSubquestion,
} from "./research.types";

const PlanSchema = z.object({
  research_question: z.string(),
  objectives: z.array(z.string()).min(1).max(8),
  constraints: z.array(z.string()).max(6),
  decision_criteria: z.array(z.string()).min(1).max(6),
  subquestions: z
    .array(
      z.object({
        question: z.string(),
        category: z.string(),
      })
    )
    .min(3)
    .max(10),
  discovery_queries: z.array(z.string()).min(2).max(6),
  source_strategy: z.string(),
});

const TerminologySchema = z.object({
  terms: z.array(z.string()).max(16),
  targeted_queries: z.array(z.string()).min(2).max(8),
});

const ClaimsSchema = z.object({
  claims: z
    .array(
      z.object({
        claim: z.string(),
        kind: z.enum(["fact", "interpretation", "opinion", "statistic", "definition", "limitation"]),
        source_index: z.number().int().nonnegative(),
        evidence: z.string(),
        subquestion_index: z.number().int().nonnegative().nullable(),
        confidence: z.number().min(0).max(1),
      })
    )
    .max(20),
});

const VerifySchema = z.object({
  updates: z.array(
    z.object({
      claim_index: z.number().int().nonnegative(),
      confidence: z.number().min(0).max(1),
      verified: z.boolean(),
      contradicting_evidence: z.string().nullable(),
    })
  ),
});

const FindingsSchema = z.object({
  findings: z
    .array(
      z.object({
        title: z.string(),
        finding: z.string(),
        evidence: z.string(),
        confidence: z.enum(["high", "medium", "low"]),
        implication: z.string(),
        limitation: z.string(),
      })
    )
    .min(1)
    .max(8),
  recommendation: z.string(),
  unknowns: z.array(z.string()).max(6),
});

const CritiqueSchema = z.object({
  answered_original: z.boolean(),
  important_claims_evidenced: z.boolean(),
  looked_for_contradictions: z.boolean(),
  unknowns: z.array(z.string()).max(6),
  confidence_statement: z.string(),
  score: z.number().min(0).max(1),
  pass: z.boolean(),
  followup_queries: z.array(z.string()).max(4),
});

const ReportSchema = z.object({
  report_markdown: z.string(),
  spoken_summary: z.string(),
});

const RoadmapTopicsSchema = z.object({
  topics: z
    .array(
      z.object({
        title: z.string().min(1),
        about: z.string().min(1),
        keywords: z.array(z.string()).max(8).default([]),
        post_type: z.enum([
          "article",
          "tutorial",
          "how_to",
          "listicle",
          "opinion",
          "case_study",
          "definitive_guide",
          "software_roundup",
          "comparison",
          "thought_leadership",
        ]),
        campaign_support: z.string().min(1),
      })
    )
    .min(1)
    .max(20),
});

type GraphState = {
  question: string;
  workspace_id: string;
  audience: string;
  depth: ResearchDepth;
  purpose: string;
  brief: ResearchBriefState;
  subquestions: ResearchSubquestion[];
  discovery_queries: string[];
  targeted_queries: string[];
  terminology: string[];
  searches: ResearchSearchRecord[];
  documents: ResearchDocument[];
  claims: ResearchClaim[];
  findings: ResearchFinding[];
  critic: ResearchCriticNotes | null;
  recommendation: string;
  unknowns: string[];
  gap_retries: number;
  critic_retries: number;
  report_markdown: string;
  spoken_summary: string;
  degraded: boolean;
  extra_queries: string[];
  search_passes: number;
};

const lastWrite = <T>(_left: T, right: T) => right;

const ResearchState = Annotation.Root({
  question: Annotation<string>(),
  workspace_id: Annotation<string>(),
  audience: Annotation<string>(),
  depth: Annotation<ResearchDepth>(),
  purpose: Annotation<string>(),
  brief: Annotation<ResearchBriefState>(),
  subquestions: Annotation<ResearchSubquestion[]>(),
  discovery_queries: Annotation<string[]>(),
  targeted_queries: Annotation<string[]>(),
  terminology: Annotation<string[]>(),
  searches: Annotation<ResearchSearchRecord[]>(),
  documents: Annotation<ResearchDocument[]>(),
  claims: Annotation<ResearchClaim[]>(),
  findings: Annotation<ResearchFinding[]>(),
  critic: Annotation<ResearchCriticNotes | null>(),
  recommendation: Annotation<string>(),
  unknowns: Annotation<string[]>(),
  gap_retries: Annotation<number>(),
  critic_retries: Annotation<number>(),
  report_markdown: Annotation<string>(),
  spoken_summary: Annotation<string>(),
  degraded: Annotation<boolean>(),
  extra_queries: Annotation<string[]>({
    reducer: lastWrite,
    default: () => [],
  }),
  search_passes: Annotation<number>(),
});

const phaseStore = new AsyncLocalStorage<NonNullable<ResearchGraphInput["onPhase"]>>();

function emitPhase(event: { phase: string; message: string; percent?: number; skill_id?: string }) {
  phaseStore.getStore()?.({ skill_id: "research", ...event });
}

function emptyBrief(question: string): ResearchBriefState {
  return {
    research_question: question,
    objectives: ["Answer the question with sourced evidence"],
    constraints: [],
    decision_criteria: ["Reliability", "Recency", "Relevance"],
    source_strategy:
      "Prefer primary documentation, then reputable analysis, then community reports of real-world issues.",
  };
}

@injectable()
export class ResearchGraphService {
  private compiledGraph?: { invoke: (state: GraphState, config?: object) => Promise<unknown> };

  constructor(
    private readonly tavily: TavilySearchService,
    private readonly artifacts: ArtifactStoreService
  ) {}

  async run(input: ResearchGraphInput): Promise<ResearchGraphResult> {
    const question = input.question.trim();
    if (!question) {
      throw new Error("Research question is required");
    }
    const depth: ResearchDepth = input.depth === "full" ? "full" : "lite";
    const emit = input.onPhase;
    const compiled = this.compile();
    const initial: GraphState = {
      question,
      workspace_id: input.workspace_id,
      audience: input.audience?.trim() || "general",
      depth,
      purpose: input.purpose ?? "general",
      brief: emptyBrief(question),
      subquestions: [],
      discovery_queries: [question],
      targeted_queries: [],
      terminology: [],
      searches: [],
      documents: [],
      claims: [],
      findings: [],
      critic: null,
      recommendation: "",
      unknowns: [],
      gap_retries: 0,
      critic_retries: 0,
      report_markdown: "",
      spoken_summary: "",
      degraded: false,
      extra_queries: [],
      search_passes: 0,
    };

    emit?.({ phase: "research_planning", message: "Defining the research brief", percent: 8, skill_id: "research" });
    const invoke = () =>
      compiled.invoke(initial, {
        recursionLimit: depth === "full" ? 36 : 24,
        signal: input.signal,
      });
    const result = (await (emit ? phaseStore.run(emit, invoke) : invoke())) as GraphState;

    const pkg = mapGraphToPackage({
      workspace_id: input.workspace_id,
      question,
      audience: input.audience,
      depth,
      purpose: input.purpose,
      brief: result.brief,
      subquestions: result.subquestions,
      searches: result.searches,
      documents: result.documents,
      claims: result.claims,
      findings: result.findings,
      critic: result.critic,
      report_markdown: result.report_markdown,
      spoken_summary: result.spoken_summary,
      degraded: result.degraded,
    });

    const persist = input.persist !== false;
    if (persist) {
      await this.artifacts.saveResearchPackage(pkg, {
        created_by: input.created_by,
        thread_id: input.thread_id,
        workspace_id: input.workspace_id,
      });
    }

    emit?.({ phase: "research_packaging", message: "Research report ready", percent: 100, skill_id: "research" });
    logger.info(
      "Research graph completed",
      {
        workspaceId: input.workspace_id,
        depth,
        sources: pkg.sources.length,
        claims: result.claims.length,
        degraded: result.degraded,
      },
      "ResearchGraphService"
    );

    return {
      package_id: pkg.id,
      report_markdown: result.report_markdown,
      spoken_summary: result.spoken_summary,
      summary: packageSummary(pkg),
      findings: result.findings,
      degraded: Boolean(result.degraded),
    };
  }

  async suggestCampaignTopics(input: {
    workspace_id: string;
    question: string;
    count: number;
    campaign_goal?: string;
    created_by?: string;
    thread_id?: string;
    signal?: AbortSignal;
  }): Promise<{ topics: CampaignTopicSuggestion[]; package_id: string; report_markdown: string }> {
    const research = await this.run({
      workspace_id: input.workspace_id,
      question: input.question,
      depth: "lite",
      purpose: "campaign",
      persist: true,
      created_by: input.created_by,
      thread_id: input.thread_id,
      signal: input.signal,
    });
    const fallbackAbout = (title: string) =>
      input.campaign_goal ? `A post that supports the campaign goal: ${input.campaign_goal}` : title;
    const fromFindings = (titles: string[]): CampaignTopicSuggestion[] =>
      titles.map((title) => ({
        title,
        about: fallbackAbout(title),
        keywords: [],
        post_type: "article" as const,
        campaign_support: input.campaign_goal
          ? `Supports the campaign goal: ${input.campaign_goal}`
          : "Supports the campaign goal.",
      }));
    const chat = this.chat();
    if (!chat) {
      const fallback = research.findings
        .map((f) => f.title)
        .filter(Boolean)
        .slice(0, input.count);
      return {
        topics: fromFindings(fallback.length ? fallback : [input.question.slice(0, 80)]),
        package_id: research.package_id,
        report_markdown: research.report_markdown,
      };
    }
    const structured = chat.withStructuredOutput(RoadmapTopicsSchema);
    const out = await structured.invoke([
      new SystemMessage(
        "Propose distinct blog/post topics from the research. Each topic needs a publishable title, a 1-2 sentence about summary, 3-6 keywords, a post_type, and how it supports the campaign. No numbering."
      ),
      new HumanMessage(`Need ${input.count} topics.\n\n${research.report_markdown.slice(0, 6000)}`),
    ]);
    return {
      topics: out.topics.slice(0, input.count).map((topic) => ({
        title: topic.title,
        about: topic.about,
        keywords: topic.keywords ?? [],
        post_type: topic.post_type,
        campaign_support: topic.campaign_support,
      })),
      package_id: research.package_id,
      report_markdown: research.report_markdown,
    };
  }

  private compile() {
    if (this.compiledGraph) return this.compiledGraph;
    const graph = new StateGraph(ResearchState)
      .addNode("plan", (s) => this.nodePlan(s as GraphState))
      .addNode("discover", (s) => this.nodeDiscover(s as GraphState))
      .addNode("search", (s) => this.nodeSearch(s as GraphState))
      .addNode("collect", (s) => this.nodeCollect(s as GraphState))
      .addNode("extract", (s) => this.nodeExtract(s as GraphState))
      .addNode("verify", (s) => this.nodeVerify(s as GraphState))
      .addNode("contrarian", (s) => this.nodeContrarian(s as GraphState))
      .addNode("gap", (s) => this.nodeGap(s as GraphState))
      .addNode("synthesize", (s) => this.nodeSynthesize(s as GraphState))
      .addNode("critique", (s) => this.nodeCritique(s as GraphState))
      .addNode("report", (s) => this.nodeReport(s as GraphState))
      .addEdge(START, "plan")
      .addEdge("plan", "discover")
      .addEdge("discover", "search")
      .addEdge("search", "collect")
      .addEdge("collect", "extract")
      .addEdge("extract", "verify")
      .addEdge("verify", "contrarian")
      .addEdge("contrarian", "gap")
      .addConditionalEdges("gap", (s) => this.routeAfterGap(s as GraphState), {
        search: "search",
        synthesize: "synthesize",
      })
      .addEdge("synthesize", "critique")
      .addConditionalEdges("critique", (s) => this.routeAfterCritique(s as GraphState), {
        search: "search",
        report: "report",
      })
      .addEdge("report", END);
    this.compiledGraph = graph.compile() as { invoke: (state: GraphState, config?: object) => Promise<unknown> };
    return this.compiledGraph;
  }

  private chat() {
    const apiKey = env.orchestrator.openaiApiKey;
    if (!apiKey) return null;
    return createChatOpenAI({
      apiKey,
      model: AGENT_MODEL,
      temperature: 0.2,
      timeout: env.orchestrator.API_TIMEOUT,
    });
  }

  private async nodePlan(state: GraphState): Promise<Partial<GraphState>> {
    emitPhase({ phase: "research_planning", message: "Planning the research brief", percent: 10 });
    const chat = this.chat();
    if (!chat) {
      return {
        brief: emptyBrief(state.question),
        subquestions: [{ id: "q1", question: state.question, category: "core", covered: false }],
        discovery_queries: [state.question],
        degraded: true,
      };
    }
    try {
      const out = await chat
        .withStructuredOutput(PlanSchema)
        .invoke([
          new SystemMessage(
            "You are a research planner. Turn the user request into a research brief. Decompose into subquestions across technology, cost, operations, security, and product fit when relevant. Prefer primary sources."
          ),
          new HumanMessage(
            `Question: ${state.question}\nAudience: ${state.audience}\nPurpose: ${state.purpose}\nDepth: ${state.depth}`
          ),
        ]);
      return {
        brief: {
          research_question: out.research_question,
          objectives: out.objectives,
          constraints: out.constraints,
          decision_criteria: out.decision_criteria,
          source_strategy: out.source_strategy,
        },
        subquestions: out.subquestions.map((q, i) => ({
          id: `sq_${i + 1}`,
          question: q.question,
          category: q.category,
          covered: false,
        })),
        discovery_queries: out.discovery_queries,
      };
    } catch (error) {
      logger.warn("Research plan fallback", { error: String(error) }, "ResearchGraphService");
      return { brief: emptyBrief(state.question), degraded: true };
    }
  }

  private async nodeDiscover(state: GraphState): Promise<Partial<GraphState>> {
    emitPhase({ phase: "research_gathering", message: "Discovering sources", percent: 18 });
    const maxQueries = state.depth === "full" ? 5 : 3;
    const { documents, searches } = await this.searchQueries(
      state,
      state.discovery_queries.slice(0, maxQueries),
      "discover"
    );
    const chat = this.chat();
    if (!chat || documents.length === 0) {
      return {
        documents,
        searches: [...state.searches, ...searches],
        targeted_queries: [state.question, `${state.question} limitations`, `${state.question} comparison`],
        degraded: state.degraded || documents.length === 0,
      };
    }
    try {
      const snippetBlock = documents
        .slice(0, 8)
        .map((d, i) => `${i + 1}. ${d.title}: ${d.snippet.slice(0, 280)}`)
        .join("\n");
      const out = await chat
        .withStructuredOutput(TerminologySchema)
        .invoke([
          new SystemMessage(
            "Extract domain terminology and better search queries from discovery snippets. Do not answer the research question yet."
          ),
          new HumanMessage(`Question: ${state.question}\n\nSnippets:\n${snippetBlock}`),
        ]);
      return {
        documents,
        searches: [...state.searches, ...searches],
        terminology: out.terms,
        targeted_queries: out.targeted_queries,
      };
    } catch {
      return {
        documents,
        searches: [...state.searches, ...searches],
        targeted_queries: state.discovery_queries,
      };
    }
  }

  private async nodeSearch(state: GraphState): Promise<Partial<GraphState>> {
    emitPhase({ phase: "research_gathering", message: "Searching targeted sources", percent: 32 });
    const extras = state.extra_queries ?? [];
    const base =
      extras.length > 0
        ? extras
        : state.targeted_queries.length
          ? state.targeted_queries
          : state.subquestions.map((q) => q.question);
    const maxQueries = state.depth === "full" ? 6 : 3;
    const { documents, searches } = await this.searchQueries(state, base.slice(0, maxQueries), "search");
    return {
      documents: this.mergeDocuments(state.documents, documents),
      searches: [...state.searches, ...searches],
      extra_queries: [],
      search_passes: (state.search_passes ?? 0) + 1,
    };
  }

  private async nodeCollect(state: GraphState): Promise<Partial<GraphState>> {
    emitPhase({ phase: "research_gathering", message: "Collecting source pages", percent: 42 });
    const maxExtract = state.depth === "full" ? 5 : 3;
    const ranked = [...state.documents].sort((a, b) => b.quality_score - a.quality_score);
    const toExtract = ranked.filter((d) => d.tier <= 3).slice(0, maxExtract);
    if (toExtract.length === 0) {
      return { degraded: state.degraded || state.documents.length === 0 };
    }
    const extracted = await this.tavily.extract(toExtract.map((d) => d.url));
    const byUrl = new Map(extracted.map((e) => [e.url, e]));
    const documents = state.documents.map((d) => {
      const hit = byUrl.get(d.url);
      if (!hit) return d;
      const next = { ...d, extracted_text: hit.text.slice(0, 8000), title: hit.title || d.title };
      return { ...next, quality_score: scoreDocument(next) };
    });
    return { documents };
  }

  private async nodeExtract(state: GraphState): Promise<Partial<GraphState>> {
    emitPhase({ phase: "research_structuring", message: "Extracting claims", percent: 52 });
    const chat = this.chat();
    const corpus = state.documents.slice(0, state.depth === "full" ? 10 : 6);
    if (!chat || corpus.length === 0) {
      return { claims: state.claims, degraded: true };
    }
    const sourceBlock = corpus
      .map(
        (d, i) =>
          `SOURCE ${i} [${hostnameOf(d.url)} tier ${d.tier}]\nTitle: ${d.title}\nURL: ${d.url}\n${(d.extracted_text || d.snippet).slice(0, 1800)}`
      )
      .join("\n\n");
    const sqBlock = state.subquestions.map((q, i) => `${i}. ${q.question}`).join("\n");
    try {
      const out = await chat
        .withStructuredOutput(ClaimsSchema)
        .invoke([
          new SystemMessage(
            "Extract atomic factual claims relevant to the research questions. Classify each as fact, statistic, definition, limitation, interpretation, or opinion. Cite source_index from the numbered sources. Do not invent URLs or numbers."
          ),
          new HumanMessage(`Question: ${state.question}\nSubquestions:\n${sqBlock}\n\n${sourceBlock}`),
        ]);
      const claims: ResearchClaim[] = out.claims.map((c, i) => {
        const doc = corpus[Math.min(c.source_index, corpus.length - 1)];
        const sq =
          c.subquestion_index != null && state.subquestions[c.subquestion_index]
            ? [state.subquestions[c.subquestion_index].id]
            : [];
        return {
          id: `cl_${i + 1}_${randomUUID().slice(0, 8)}`,
          claim: c.claim,
          kind: c.kind,
          source_ids: doc ? [doc.id] : [],
          supporting_evidence: c.evidence ? [c.evidence] : [],
          contradicting_evidence: [],
          confidence: c.confidence,
          subquestion_ids: sq,
          verified: false,
        };
      });
      const coveredIds = new Set(claims.flatMap((c) => c.subquestion_ids));
      return {
        claims: this.mergeClaims(state.claims, claims),
        subquestions: state.subquestions.map((q) => ({ ...q, covered: q.covered || coveredIds.has(q.id) })),
      };
    } catch (error) {
      logger.warn("Research extract fallback", { error: String(error) }, "ResearchGraphService");
      return { degraded: true };
    }
  }

  private async nodeVerify(state: GraphState): Promise<Partial<GraphState>> {
    emitPhase({ phase: "research_verify", message: "Verifying important claims", percent: 62 });
    const important = state.claims
      .filter((c) => c.kind === "fact" || c.kind === "statistic")
      .slice(0, state.depth === "full" ? 4 : 2);
    if (important.length === 0) return {};
    const queries = important.map((c) => c.claim.slice(0, 120));
    const { documents, searches } = await this.searchQueries(state, queries, "verify");
    const mergedDocs = this.mergeDocuments(state.documents, documents);
    const chat = this.chat();
    if (!chat) {
      return { documents: mergedDocs, searches: [...state.searches, ...searches] };
    }
    try {
      const snippet = documents
        .slice(0, 6)
        .map((d) => `- ${d.title}: ${d.snippet.slice(0, 220)}`)
        .join("\n");
      const claimBlock = important.map((c, i) => `${i}. ${c.claim}`).join("\n");
      const out = await chat
        .withStructuredOutput(VerifySchema)
        .invoke([
          new SystemMessage(
            "Verify claims against independent snippets. Lower confidence if only vendor marketing supports them. Note contradictions."
          ),
          new HumanMessage(`Claims:\n${claimBlock}\n\nIndependent snippets:\n${snippet || "(none)"}`),
        ]);
      const claims = state.claims.map((c) => ({ ...c }));
      for (const update of out.updates) {
        const target = important[update.claim_index];
        if (!target) continue;
        const idx = claims.findIndex((c) => c.id === target.id);
        if (idx < 0) continue;
        claims[idx] = {
          ...claims[idx],
          confidence: update.confidence,
          verified: update.verified,
          contradicting_evidence: update.contradicting_evidence
            ? [...claims[idx].contradicting_evidence, update.contradicting_evidence]
            : claims[idx].contradicting_evidence,
        };
      }
      return {
        claims,
        documents: mergedDocs,
        searches: [...state.searches, ...searches],
      };
    } catch {
      return { documents: mergedDocs, searches: [...state.searches, ...searches] };
    }
  }

  private async nodeContrarian(state: GraphState): Promise<Partial<GraphState>> {
    if (state.depth !== "full") return {};
    emitPhase({ phase: "research_verify", message: "Searching for counter-evidence", percent: 70 });
    const queries = [
      `${state.question} limitations`,
      `${state.question} problems production`,
      ...(state.brief.research_question ? [`${state.brief.research_question} criticism`] : []),
    ].slice(0, 3);
    const { documents, searches } = await this.searchQueries(state, queries, "contrarian");
    const mergedDocs = this.mergeDocuments(state.documents, documents);
    const chat = this.chat();
    if (!chat || documents.length === 0) {
      return { documents: mergedDocs, searches: [...state.searches, ...searches] };
    }
    try {
      const snippet = documents.map((d) => `- ${d.title}: ${d.snippet.slice(0, 240)}`).join("\n");
      const out = await chat
        .withStructuredOutput(ClaimsSchema)
        .invoke([
          new SystemMessage(
            "Extract claims that would weaken or contradict the current conclusion. Prefer limitations and production problems."
          ),
          new HumanMessage(`Current question: ${state.question}\n\nCounter snippets:\n${snippet}`),
        ]);
      const extra: ResearchClaim[] = out.claims.map((c, i) => {
        const doc = documents[Math.min(c.source_index, documents.length - 1)];
        return {
          id: `ctr_${i + 1}_${randomUUID().slice(0, 8)}`,
          claim: c.claim,
          kind: c.kind === "fact" ? "limitation" : c.kind,
          source_ids: doc ? [doc.id] : [],
          supporting_evidence: c.evidence ? [c.evidence] : [],
          contradicting_evidence: [],
          confidence: c.confidence,
          subquestion_ids: [],
          verified: false,
        };
      });
      return {
        documents: mergedDocs,
        searches: [...state.searches, ...searches],
        claims: this.mergeClaims(state.claims, extra),
      };
    } catch {
      return { documents: mergedDocs, searches: [...state.searches, ...searches] };
    }
  }

  private nodeGap(state: GraphState): Partial<GraphState> {
    const stopping = evaluateStopping({
      subquestions: state.subquestions,
      claims: state.claims,
      documents: state.documents,
      criticScore: state.critic?.score ?? (state.depth === "lite" ? 0.75 : 0.5),
      criticThreshold: state.depth === "full" ? 0.7 : 0.55,
      sourceQualityThreshold: 0.35,
    });
    const uncovered = state.subquestions.filter((q) => !q.covered).map((q) => q.question);
    const maxGaps = 2;
    if (!stopping.complete && state.gap_retries < maxGaps && uncovered.length > 0) {
      return {
        gap_retries: state.gap_retries + 1,
        extra_queries: uncovered.slice(0, 3),
      };
    }
    return { extra_queries: [] };
  }

  private routeAfterGap(state: GraphState): "search" | "synthesize" {
    const maxSearchPasses = state.depth === "full" ? 4 : 3;
    if (state.search_passes >= maxSearchPasses) return "synthesize";
    return state.extra_queries.length > 0 ? "search" : "synthesize";
  }

  private async nodeSynthesize(state: GraphState): Promise<Partial<GraphState>> {
    emitPhase({ phase: "research_structuring", message: "Synthesizing findings", percent: 80 });
    const chat = this.chat();
    const claimBlock = state.claims
      .slice(0, 18)
      .map((c) => `- [${c.kind} / ${c.confidence.toFixed(2)}] ${c.claim}`)
      .join("\n");
    if (!chat) {
      const findings: ResearchFinding[] = state.claims.slice(0, 4).map((c, i) => ({
        id: `f_${i + 1}`,
        title: c.claim.slice(0, 80),
        finding: c.claim,
        evidence: c.supporting_evidence.join(" "),
        confidence: c.confidence >= 0.7 ? "high" : c.confidence >= 0.45 ? "medium" : "low",
        implication: "Use with caution; model synthesis unavailable.",
        limitation: "No synthesizer model configured.",
        claim_ids: [c.id],
      }));
      return {
        findings,
        recommendation: findings[0]?.finding ?? "Insufficient evidence to recommend.",
        unknowns: ["Model synthesis unavailable"],
      };
    }
    try {
      const out = await chat
        .withStructuredOutput(FindingsSchema)
        .invoke([
          new SystemMessage(
            "Synthesize research into decision-useful findings. Separate facts from interpretations and opinions. Each finding needs implication, limitation, and confidence. End with a recommendation that answers the original question."
          ),
          new HumanMessage(
            `Question: ${state.question}\nObjectives: ${state.brief.objectives.join("; ")}\nCriteria: ${state.brief.decision_criteria.join("; ")}\n\nClaims:\n${claimBlock || "(none)"}`
          ),
        ]);
      return {
        findings: out.findings.map((f, i) => ({
          id: `f_${i + 1}`,
          title: f.title,
          finding: f.finding,
          evidence: f.evidence,
          confidence: f.confidence,
          implication: f.implication,
          limitation: f.limitation,
          claim_ids: [],
        })),
        recommendation: out.recommendation,
        unknowns: out.unknowns,
      };
    } catch (error) {
      logger.warn("Research synthesize fallback", { error: String(error) }, "ResearchGraphService");
      return {
        recommendation: "Synthesis failed; see extracted claims.",
        unknowns: ["Synthesis model error"],
        degraded: true,
      };
    }
  }

  private async nodeCritique(state: GraphState): Promise<Partial<GraphState>> {
    emitPhase({ phase: "research_verify", message: "Critiquing the evidence", percent: 86 });
    if (state.depth !== "full") {
      return {
        critic: {
          answered_original: true,
          important_claims_evidenced: state.claims.length > 0,
          looked_for_contradictions: false,
          unknowns: state.unknowns,
          confidence_statement: "Lite research skipped the critic pass.",
          score: 0.72,
          pass: true,
        },
      };
    }
    const chat = this.chat();
    if (!chat) {
      return {
        critic: {
          answered_original: Boolean(state.recommendation),
          important_claims_evidenced: state.claims.length > 0,
          looked_for_contradictions: true,
          unknowns: state.unknowns,
          confidence_statement: "Critic model unavailable.",
          score: 0.6,
          pass: true,
        },
      };
    }
    try {
      const out = await chat
        .withStructuredOutput(CritiqueSchema)
        .invoke([
          new SystemMessage(
            "You are a research critic. Answer: Did we answer the original question? Do important claims have evidence? Did we look for contradictions? What don't we know? How confident should we be?"
          ),
          new HumanMessage(
            `Question: ${state.question}\nRecommendation: ${state.recommendation}\nFindings: ${state.findings.map((f) => f.finding).join(" | ")}\nUnknowns: ${state.unknowns.join("; ")}\nSources: ${state.documents.length}\nClaims: ${state.claims.length}`
          ),
        ]);
      const critic: ResearchCriticNotes = {
        answered_original: out.answered_original,
        important_claims_evidenced: out.important_claims_evidenced,
        looked_for_contradictions: out.looked_for_contradictions,
        unknowns: out.unknowns,
        confidence_statement: out.confidence_statement,
        score: out.score,
        pass: out.pass && out.score >= 0.7,
      };
      if (!critic.pass && state.critic_retries < 1 && out.followup_queries.length) {
        return {
          critic,
          critic_retries: state.critic_retries + 1,
          extra_queries: out.followup_queries,
        };
      }
      return { critic: { ...critic, pass: true }, extra_queries: [] };
    } catch {
      return {
        critic: {
          answered_original: true,
          important_claims_evidenced: true,
          looked_for_contradictions: true,
          unknowns: state.unknowns,
          confidence_statement: "Critic pass failed open.",
          score: 0.65,
          pass: true,
        },
      };
    }
  }

  private routeAfterCritique(state: GraphState): "search" | "report" {
    const maxSearchPasses = state.depth === "full" ? 5 : 4;
    if (
      state.extra_queries.length > 0 &&
      state.critic_retries <= 1 &&
      !state.critic?.pass &&
      state.search_passes < maxSearchPasses
    ) {
      return "search";
    }
    return "report";
  }

  private async nodeReport(state: GraphState): Promise<Partial<GraphState>> {
    emitPhase({ phase: "research_report", message: "Writing the research report", percent: 94 });
    const sources = state.documents
      .slice(0, 12)
      .map((d, i) => `${i + 1}. [${d.title}](${d.url}) (tier ${d.tier})`)
      .join("\n");
    const fallback = this.fallbackReport(state, sources);
    const chat = this.chat();
    if (!chat) {
      return {
        report_markdown: fallback,
        spoken_summary: state.recommendation.slice(0, 400) || fallback.slice(0, 400),
      };
    }
    try {
      const out = await chat
        .withStructuredOutput(ReportSchema)
        .invoke([
          new SystemMessage(
            "Write a research report in Markdown for a human reader. No HTML, no code fences wrapping the whole report, no JSON, no tool names. Structure: Executive summary, research question, key findings (each with evidence, confidence, implication), contradictory evidence, uncertainties, recommendation, sources as markdown links. spoken_summary must be 2–4 spoken sentences: conclusion plus one caveat, no URLs."
          ),
          new HumanMessage(
            `Question: ${state.question}\nRecommendation: ${state.recommendation}\nFindings JSON: ${JSON.stringify(state.findings).slice(0, 5000)}\nUnknowns: ${state.unknowns.join("; ")}\nCritic: ${state.critic?.confidence_statement ?? ""}\nSources:\n${sources}`
          ),
        ]);
      return {
        report_markdown: out.report_markdown.replace(/```[\s\S]*?```/g, "").trim() || fallback,
        spoken_summary: out.spoken_summary.trim() || state.recommendation.slice(0, 400),
      };
    } catch {
      return { report_markdown: fallback, spoken_summary: state.recommendation.slice(0, 400) };
    }
  }

  private fallbackReport(state: GraphState, sources: string): string {
    const findings = state.findings
      .map(
        (f) =>
          `### ${f.title}\n${f.finding}\n\nEvidence: ${f.evidence}\nConfidence: ${f.confidence}\nImplication: ${f.implication}\nLimitation: ${f.limitation}`
      )
      .join("\n\n");
    return [
      `## Executive summary`,
      state.recommendation || "Research completed with limited synthesis.",
      ``,
      `## Research question`,
      state.brief.research_question || state.question,
      ``,
      `## Key findings`,
      findings || "No structured findings were extracted.",
      ``,
      `## Areas of uncertainty`,
      (state.unknowns.length ? state.unknowns : ["See source limitations."]).map((u) => `- ${u}`).join("\n"),
      ``,
      `## Recommendation`,
      state.recommendation || "Gather more primary sources before a firm decision.",
      ``,
      `## Sources`,
      sources || "No sources retrieved.",
    ].join("\n");
  }

  private async searchQueries(
    state: GraphState,
    queries: string[],
    phase: ResearchSearchRecord["phase"]
  ): Promise<{ documents: ResearchDocument[]; searches: ResearchSearchRecord[] }> {
    const documents: ResearchDocument[] = [];
    const searches: ResearchSearchRecord[] = [];
    const maxSources = state.depth === "full" ? 12 : 8;
    const seen = new Set(state.documents.map((d) => d.url));
    for (const query of queries) {
      const notes = await this.tavily.search(query);
      searches.push({ query, phase, result_count: notes.length });
      for (const note of notes) {
        if (seen.has(note.url)) continue;
        seen.add(note.url);
        const tier = classifySourceTier(note.url, note.title);
        const relevance_score = Math.max(0.35, 1 - documents.length * 0.05);
        const doc: ResearchDocument = {
          id: `src_${randomUUID().slice(0, 10)}`,
          url: note.url,
          title: note.title || note.url,
          snippet: note.snippet,
          source: hostnameOf(note.url),
          tier,
          relevance_score,
          credibility_score: { 1: 0.9, 2: 0.7, 3: 0.45, 4: 0.25 }[tier],
          quality_score: 0,
        };
        doc.quality_score = scoreDocument(doc);
        documents.push(doc);
        if (state.documents.length + documents.length >= maxSources) break;
      }
      if (state.documents.length + documents.length >= maxSources) break;
    }
    return { documents, searches };
  }

  private mergeDocuments(existing: ResearchDocument[], incoming: ResearchDocument[]): ResearchDocument[] {
    const byUrl = new Map(existing.map((d) => [d.url, d]));
    for (const doc of incoming) {
      if (!byUrl.has(doc.url)) byUrl.set(doc.url, doc);
    }
    return [...byUrl.values()];
  }

  private mergeClaims(existing: ResearchClaim[], incoming: ResearchClaim[]): ResearchClaim[] {
    const seen = new Set(existing.map((c) => c.claim.toLowerCase()));
    const next = [...existing];
    for (const claim of incoming) {
      const key = claim.claim.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      next.push(claim);
    }
    return next;
  }
}
