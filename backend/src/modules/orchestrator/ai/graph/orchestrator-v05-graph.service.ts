import { randomUUID } from "crypto";
import { injectable } from "tsyringe";
import { BlogService } from "../../../blog/services/blog.service";
import { FirstPartyPriorsService } from "../../../blog/ai/first-party-priors.service";
import { BlogStatus } from "../../../../shared/constants";
import { env } from "../../../../shared/config/env";
import { ConversationIntelligenceService } from "../conversation-intelligence/conversation-intelligence";
import { MemoryManagerService } from "../memory/manager/memory-manager";
import { createPhaseCollector, type PhaseListener, type WorkflowPhaseEvent } from "../observability/phase-emitter";
import { buildV05MoatSnapshot } from "../observability/moat-snapshot";
import { incrementCounter } from "../observability/skill-metrics";
import { createTurnTracer, type CompletedSpan, type TurnTracer } from "../observability/turn-tracer";
import type { OptimizationPlan } from "../contracts/content-optimization";
import type { ConversationContext } from "../contracts/conversation-context";
import { ContentOptimizationService } from "../skills/content-optimization/content-optimization.service";
import { ResearchSkillService } from "../skills/research/research-skill.service";
import { SkillRegistry } from "../skills/registry";
import { ContentStrategyService } from "../skills/strategy/content-strategy.service";
import { WritingSkillService } from "../skills/writing/writing.service";
import { ConversationSkillService } from "../skills/conversation/conversation.service";
import { StrategicContextService } from "../services/strategic-context.service";
import { CampaignService } from "../../../campaign/services/campaign.service";
import { ResearchPackageRepository } from "../../repositories/research-package.repository";
import { resolveResearchTopic } from "../skills/research/resolve-research-topic";
import {
  buildOrchestratorGraph,
  invokeTurn,
  type CompiledOrchestratorGraph,
  type OrchestratorGraphDeps,
} from "./orchestrator.graph";
import type { OrchestratorState } from "./state";
import type { WorkflowMode } from "../contracts/enums";
import { buildGroundedWritingPrompt, isPostFormat, type PostFormat } from "../contracts/post-format";
import { buildVoiceConversationInstructions } from "../../utils/voice-conversation.helper";
import {
  isApproveLikeMessage,
  isReviseOutlineMessage,
  isReviseResearchMessage,
  recoverWritingStateFromHistory,
} from "../../utils/writing-hitl.helper";
import {
  advanceCampaignCollect,
  recoverCampaignDraftFromHistory,
  type CampaignDraftSlots,
} from "../../utils/campaign-collect.helper";
import type { ResearchPackageSummary } from "../contracts/research-package";

function buildBlogPreviewUrl(blogId: string): string {
  const base = env.frontend.baseUrl.replace(/\/$/, "");
  return `${base}/dashboard/blogs/${blogId}`;
}

type DraftRecord = {
  title?: string;
  content?: string;
  excerpt?: string;
  meta?: { description?: string; keywords?: string[] };
  blog_id?: string;
};

/** Map skill progress events into client tool_calls (research package + outline for HITL cards). */
function buildSkillToolCalls(
  state: OrchestratorState,
  phases: readonly WorkflowPhaseEvent[]
): Array<{ tool: string; summary: string; output_data: Record<string, unknown> }> {
  const moat = buildV05MoatSnapshot(state, phases);
  return state.progress_events
    .filter((e) => e.type === "invoke_skill")
    .map((e) => {
      const skill = String(e.meta?.skill_id ?? "skill");
      const phase = typeof e.meta?.phase === "string" ? e.meta.phase : undefined;
      const output_data: Record<string, unknown> = { ...(e.meta ?? {}) };

      if (skill === "research") {
        if (moat.research_summary) output_data.research_summary = moat.research_summary;
        if (state.research_package_id) output_data.research_package_id = state.research_package_id;
        // #region agent log
        fetch("http://127.0.0.1:7845/ingest/3b4333d1-9478-4155-a0c2-6acee25e28ec", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "17457c" },
          body: JSON.stringify({
            sessionId: "17457c",
            runId: "post-fix",
            hypothesisId: "H-PERSIST",
            location: "orchestrator-v05-graph.service.ts:buildSkillToolCalls",
            message: "research tool_call branch",
            data: {
              hasPackage: Boolean(state.research_package),
              packageId: state.research_package_id ?? null,
              factCount: state.research_package?.facts?.length ?? 0,
              hasSummary: Boolean(moat.research_summary),
            },
            timestamp: Date.now(),
          }),
        }).catch(() => {});
        // #endregion
        if (state.research_package) {
          // Client card needs findings; keep payload bounded.
          const pkg = state.research_package;
          const keyInsights =
            (Array.isArray(state.metadata?.research_key_insights) &&
              (state.metadata.research_key_insights as string[])) ||
            (Array.isArray((pkg as unknown as { key_insights?: string[] }).key_insights)
              ? (pkg as unknown as { key_insights: string[] }).key_insights
              : []);
          const facts = pkg.facts.slice(0, 12).map((f) => ({
            text: f.text,
            ...(f.value ? { value: f.value } : {}),
          }));
          const definitions = pkg.definitions.slice(0, 8).map((f) => ({
            text: f.text,
            ...(f.value ? { value: f.value } : {}),
          }));
          const statistics = pkg.statistics.slice(0, 8).map((f) => ({
            text: f.text,
            ...(f.value ? { value: f.value } : {}),
          }));
          // Flatten findings to top-level so the chat card survives nested truncation.
          output_data.topic = pkg.topic;
          output_data.facts = facts;
          output_data.definitions = definitions;
          output_data.statistics = statistics;
          output_data.sources = pkg.sources.slice(0, 10).map((s) => ({
            id: s.id,
            title: s.title,
            url: s.url,
          }));
          output_data.research_package = {
            id: pkg.id,
            topic: pkg.topic,
            depth: pkg.depth,
            degraded: pkg.degraded,
            facts,
            definitions,
            statistics,
            sources: output_data.sources,
            references: pkg.references.slice(0, 10),
            coverage: pkg.coverage,
            ...(keyInsights.length ? { key_insights: keyInsights.slice(0, 6) } : {}),
          };
          if (keyInsights.length) output_data.key_insights = keyInsights.slice(0, 6);
          // #region agent log
          fetch("http://127.0.0.1:7845/ingest/3b4333d1-9478-4155-a0c2-6acee25e28ec", {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "17457c" },
            body: JSON.stringify({
              sessionId: "17457c",
              runId: "post-fix",
              hypothesisId: "H-UI",
              location: "orchestrator-v05-graph.service.ts:buildSkillToolCalls",
              message: "research tool_call payload",
              data: {
                topic: pkg.topic,
                factCount: facts.length,
                defCount: definitions.length,
                statCount: statistics.length,
                insightCount: keyInsights.length,
                sample: facts[0]?.text?.slice(0, 80) ?? null,
              },
              timestamp: Date.now(),
            }),
          }).catch(() => {});
          // #endregion
        }
        if (state.metadata?.writing_checkpoint === "research" || state.workflow_stage === "research") {
          output_data.writing_checkpoint = "research";
        }
        return { tool: "research", summary: e.message ?? "research", output_data };
      }

      if (skill === "writing" && (phase === "outline" || state.outline) && !state.draft) {
        output_data.action = "outline";
        output_data.outline = state.outline;
        output_data.writing_checkpoint = "outline";
        if (state.research_package_id) output_data.research_package_id = state.research_package_id;
        return { tool: "writing.outline", summary: e.message ?? "outline", output_data };
      }

      if (skill === "writing") {
        output_data.action = phase === "improve" ? "revise" : "draft";
      }
      if (skill === "content_optimization" && moat.optimization) {
        output_data.optimization = moat.optimization;
      }

      // Persist campaign collect progress for cross-turn recovery.
      if (skill === "conversation" && state.metadata?.campaign_draft) {
        return {
          tool: "campaign.collect",
          summary: e.message ?? "campaign collect",
          output_data: {
            ...output_data,
            campaign_draft: state.metadata.campaign_draft,
          },
        };
      }

      return {
        tool: skill,
        summary: e.message ?? "skill",
        output_data,
      };
    });
}

function buildClientFacingCampaignToolCalls(state: OrchestratorState): Array<{
  tool: string;
  summary: string;
  output_data: Record<string, unknown>;
}> {
  const created = state.metadata?.created_campaign;
  if (!created || typeof created !== "object") return [];
  const c = created as Record<string, unknown>;
  const name = typeof c.name === "string" ? c.name : "Campaign";
  return [
    {
      tool: "campaigns.create",
      summary: `Created campaign '${name}'.`,
      output_data: c,
    },
  ];
}

/** Map v0.5 skill outputs into blogs.* tool_calls the left panel already understands. */
function buildClientFacingBlogToolCalls(state: OrchestratorState): Array<{
  tool: string;
  summary: string;
  output_data: Record<string, unknown>;
}> {
  const draft = state.draft as DraftRecord | undefined;
  const blogId =
    (typeof state.metadata?.blog_id === "string" && state.metadata.blog_id) ||
    (typeof draft?.blog_id === "string" && draft.blog_id) ||
    undefined;
  if (!draft?.title || !draft.content || !blogId) return [];

  const previewUrl = buildBlogPreviewUrl(blogId);
  const scores = (state.metadata?.quality_scores ?? {}) as Record<string, unknown>;
  const overall = typeof scores.overall === "number" ? scores.overall : undefined;
  const plan = state.optimization_plan as OptimizationPlan | undefined;
  const suggestions = plan
    ? [...plan.critical, ...plan.high, ...plan.medium, ...plan.low].slice(0, 20).map((r) => ({
        id: r.id,
        suggestion: r.message,
        explanation: r.suggested_action ?? r.dimension,
      }))
    : [];

  const calls: Array<{ tool: string; summary: string; output_data: Record<string, unknown> }> = [
    {
      tool: state.optimize_count > 0 && !plan ? "blogs.update" : "blogs.generateDraft",
      summary:
        state.optimize_count > 0 && !plan
          ? `Updated '${draft.title}' (${draft.content.length.toLocaleString()} chars). Draft ${blogId}. Preview: ${previewUrl}`
          : `Generated '${draft.title}' (${draft.content.length.toLocaleString()} chars). Saved as draft ${blogId}. Preview: ${previewUrl}`,
      output_data: {
        blog_id: blogId,
        id: blogId,
        title: draft.title,
        excerpt: draft.excerpt,
        content: draft.content,
        meta: draft.meta,
        saved_as_draft: true,
        preview_url: previewUrl,
        updated_at: new Date().toISOString(),
        ...(overall !== undefined ? { review_score: overall } : {}),
      },
    },
  ];

  if (plan && overall !== undefined) {
    calls.push({
      tool: "blogs.review",
      summary: `Reviewed '${draft.title}' — overall score ${overall}/100.`,
      output_data: {
        blog_id: blogId,
        id: blogId,
        title: draft.title,
        overall_score: overall,
        summary: plan.writing_brief || `Quality gate ${state.quality_gate_passed ? "passed" : "failed"}.`,
        suggestions,
      },
    });
  }

  return calls;
}

export type V05GraphTurnInput = {
  workspace_id: string;
  user_id: string;
  thread_id: string;
  message: string;
  mode?: WorkflowMode;
  recent_messages?: Array<{ role: "user" | "assistant"; content: string }>;
  /** Full history (with tool_calls) for writing HITL / campaign draft recovery. */
  history_messages?: Array<{
    role: string;
    tool_calls?: Array<{ tool: string; output_data?: Record<string, unknown> | null }>;
  }>;
  /** Voice/call UI — CI prefers discuss-before-draft. */
  conversation_mode?: boolean;
  /** Workspace brief product-steer lines for voice Conversation skill. */
  voice_product_steer?: string;
  /** When already classified (ops peek), skip a second ci.analyze call. */
  conversation_context?: ConversationContext;
  /** Active draft / highlight from the results panel. */
  selection?: {
    blog_id: string;
    reference_type?: "highlight" | "blog";
    text?: string;
  };
  onPhase?: PhaseListener;
};

export type V05GraphTurnResult = {
  state: OrchestratorState;
  reply: string;
  tool_calls: Array<{ tool: string; summary: string; output_data?: unknown }>;
  spans: readonly CompletedSpan[];
  phases: readonly WorkflowPhaseEvent[];
};

/**
 * v0.5 LangGraph turn runner (CI → graph). Used when ORCHESTRATOR_V05_GRAPH_ENABLED.
 */
@injectable()
export class OrchestratorV05GraphService {
  private compiled: CompiledOrchestratorGraph | null = null;
  private graphDeps: OrchestratorGraphDeps | null = null;

  constructor(
    private readonly ci: ConversationIntelligenceService,
    private readonly memory: MemoryManagerService,
    private readonly research: ResearchSkillService,
    private readonly writing: WritingSkillService,
    private readonly optimize: ContentOptimizationService,
    private readonly strategy: ContentStrategyService,
    private readonly conversation: ConversationSkillService,
    private readonly blogService: BlogService,
    private readonly strategicContext: StrategicContextService,
    private readonly firstPartyPriors: FirstPartyPriorsService,
    private readonly campaignService: CampaignService,
    private readonly researchPackages: ResearchPackageRepository
  ) {}

  async runTurn(input: V05GraphTurnInput): Promise<V05GraphTurnResult> {
    const turn_id = randomUUID();
    const ci_analyze_id = randomUUID();
    const tracer = createTurnTracer({
      turn_id,
      thread_id: input.thread_id,
      workspace_id: input.workspace_id,
      user_id: input.user_id,
      ci_analyze_id,
    });
    const { phases, emit } = createPhaseCollector(input.onPhase);

    const turnSpan = tracer.startSpan("turn", { turn_id });
    try {
      const openArtifacts = input.selection?.blog_id ? { draft_id: input.selection.blog_id } : undefined;

      let conversation_context = await tracer.timed("ci.analyze", { ci_analyze_id }, async (span) => {
        const ctx =
          input.conversation_context ??
          (await this.ci.analyze({
            message: input.message,
            workspace_id: input.workspace_id,
            user_id: input.user_id,
            thread_id: input.thread_id,
            recent_messages: input.recent_messages,
            conversation_mode: input.conversation_mode,
            open_artifacts: openArtifacts,
          }));
        span.setAttributes({
          communicative_category: ctx.communicative_category,
          workflow_intent: ctx.workflow_intent,
          suggested_next_action: ctx.suggested_next_action,
          confidence: ctx.confidence,
          requires_clarification: ctx.requires_clarification,
          action_required: ctx.action_required,
        });
        incrementCounter(`ci.category_rate.${ctx.communicative_category}`);
        if (ctx.requires_clarification) incrementCounter("ci.clarify_rate");
        return ctx;
      });

      // Selection + section-edit language: force revise even if peek CI missed it.
      const sectionEdit =
        /\b(?:rewrite|update|revise|change|improve|spice\s+up|try\s+another\s+approach)\b[\s\S]{0,80}\b(?:intro|introduction|conclusion|section|ending|opening)\b|\b(?:add|remove|delete)\s+(?:a\s+)?section\b|\bonly\s+the\s+(?:conclusion|introduction|intro)\b|\bnew\s+conclusion\b/i.test(
          input.message
        );
      const didSectionOverride =
        !!input.selection?.blog_id &&
        sectionEdit &&
        conversation_context.suggested_next_action !== "revise_current_artifact";
      if (didSectionOverride) {
        conversation_context = {
          ...conversation_context,
          communicative_category: "provide_feedback",
          workflow_intent: "update_content",
          suggested_next_action: "revise_current_artifact",
          action_required: true,
          requires_clarification: false,
          conversation_mode: "editing",
          communicative_rationale: `section_edit_override:${conversation_context.communicative_rationale ?? ""}`,
        };
      }

      // Recover writing HITL + campaign draft from prior assistant tool_calls.
      const recovered = recoverWritingStateFromHistory(input.history_messages ?? []);
      // Always prefer the full persisted package (tool_call payloads are truncated for the card).
      if (recovered.research_package_id) {
        const pkg = await this.researchPackages
          .findById(input.workspace_id, recovered.research_package_id)
          .catch(() => null);
        if (pkg) {
          recovered.research_package = pkg as unknown as Record<string, unknown>;
          recovered.research_summary = {
            topic: pkg.topic,
            depth: pkg.depth,
            coverage_score: pkg.coverage.coverage_score,
            source_count: pkg.sources.length,
            contradiction_count: pkg.contradictions.length,
            degraded: pkg.degraded,
          };
        }
      }

      const campaignDraftPrior =
        recoverCampaignDraftFromHistory(input.history_messages ?? []) ??
        (undefined as CampaignDraftSlots | undefined);

      const campaignIntentNow =
        conversation_context.workflow_intent === "create_campaign" ||
        conversation_context.workflow_intent === "update_campaign" ||
        conversation_context.workflow_intent === "learn_campaign" ||
        conversation_context.workflow_intent === "discuss_campaign" ||
        conversation_context.workflow_intent === "campaign_content" ||
        conversation_context.workflow_intent === "campaign_performance";

      // HITL approve/continue/revise — force create path even if CI called it casual.
      // Skip when this turn is a campaign intent (stale research checkpoint must not hijack).
      if (
        !campaignIntentNow &&
        recovered.writing_checkpoint &&
        (isApproveLikeMessage(input.message) ||
          isReviseResearchMessage(input.message) ||
          isReviseOutlineMessage(input.message))
      ) {
        const slots_patch = {
          ...(conversation_context.slots_patch ?? {}),
          ...(recovered.writing_checkpoint === "research" &&
          isApproveLikeMessage(input.message) &&
          !isReviseResearchMessage(input.message)
            ? { research_approved: true }
            : {}),
          ...(recovered.writing_checkpoint === "outline" &&
          isApproveLikeMessage(input.message) &&
          !isReviseOutlineMessage(input.message)
            ? { outline_approved: true }
            : {}),
        };
        conversation_context = {
          ...conversation_context,
          communicative_category: "request_action",
          workflow_intent: "create_content",
          suggested_next_action: "start_content_workflow",
          action_required: true,
          requires_clarification: false,
          conversation_mode: "creation",
          slots_patch,
          communicative_rationale: `writing_hitl_${recovered.writing_checkpoint}:${conversation_context.communicative_rationale ?? ""}`,
        };
      }

      let seededDraft: DraftRecord | undefined;
      let seededBlogId: string | undefined = input.selection?.blog_id;
      if (seededBlogId) {
        try {
          const blog = await this.blogService.getBlogById(seededBlogId, input.workspace_id, input.user_id);
          seededDraft = {
            title: blog.title,
            content: blog.content,
            excerpt: blog.excerpt,
            meta: blog.meta as DraftRecord["meta"],
            blog_id: seededBlogId,
          };
        } catch {
          seededBlogId = undefined;
          seededDraft = undefined;
        }
      }

      const { compiled, deps } = this.getCompiled();
      deps.tracer = tracer;
      deps.onPhase = emit;

      const voiceMeta: Record<string, unknown> = {};
      if (input.conversation_mode) {
        voiceMeta.voice_call = true;
      }
      if (input.voice_product_steer?.trim()) {
        voiceMeta.voice_product_steer = input.voice_product_steer.trim();
      }
      // Do not seed stale writing checkpoints into campaign turns.
      if (recovered.writing_checkpoint && !campaignIntentNow) {
        voiceMeta.writing_checkpoint = recovered.writing_checkpoint;
      }
      if (campaignDraftPrior) {
        voiceMeta.campaign_draft = campaignDraftPrior;
      }

      const state = await invokeTurn(compiled, {
        turn_id,
        thread_id: input.thread_id,
        workspace_id: input.workspace_id,
        user_id: input.user_id,
        message: input.message,
        conversation_context,
        mode: input.mode ?? "chat",
        recent_messages: input.recent_messages,
        draft: seededDraft as Record<string, unknown> | undefined,
        research_package_id: campaignIntentNow ? undefined : recovered.research_package_id,
        research_summary: campaignIntentNow
          ? undefined
          : (recovered.research_summary as ResearchPackageSummary | undefined),
        research_package: campaignIntentNow
          ? undefined
          : (recovered.research_package as OrchestratorState["research_package"]),
        outline: campaignIntentNow ? undefined : recovered.outline,
        metadata: {
          ...(seededBlogId ? { blog_id: seededBlogId } : {}),
          ...voiceMeta,
        },
        selection: input.selection
          ? {
              blog_id: input.selection.blog_id,
              highlight: input.selection.text,
            }
          : undefined,
      });

      deps.tracer = undefined;
      deps.onPhase = undefined;

      const skillToolCalls = buildSkillToolCalls(state, phases);
      const clientBlogCalls = buildClientFacingBlogToolCalls(state);
      const clientCampaignCalls = buildClientFacingCampaignToolCalls(state);
      const tool_calls = [...skillToolCalls, ...clientBlogCalls, ...clientCampaignCalls];

      // #region agent log
      fetch("http://127.0.0.1:7845/ingest/3b4333d1-9478-4155-a0c2-6acee25e28ec", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "17457c" },
        body: JSON.stringify({
          sessionId: "17457c",
          runId: "post-fix",
          hypothesisId: "H-A",
          location: "orchestrator-v05-graph.service.ts:runTurn",
          message: "turn tool_calls built",
          data: {
            intent: conversation_context.workflow_intent,
            recoveredCheckpoint: recovered.writing_checkpoint ?? null,
            recoveredResearchId: recovered.research_package_id ?? null,
            seededBlogId: seededBlogId ?? null,
            hasStateDraft: Boolean(state.draft),
            writingCheckpointMeta: state.metadata?.writing_checkpoint ?? null,
            skillTools: skillToolCalls.map((t) => t.tool),
            blogTools: clientBlogCalls.map((t) => t.tool),
            campaignTools: clientCampaignCalls.map((t) => t.tool),
            stage: state.workflow_stage,
            replyPreview: (state.reply ?? "").slice(0, 100),
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion

      turnSpan.end({
        status: "ok",
        attrs: {
          workflow_stage: state.workflow_stage,
          skills_run: state.skills_run_this_turn,
          mode: state.mode,
          phase_count: phases.length,
        },
      });

      return {
        state,
        reply: state.reply ?? "Done.",
        tool_calls,
        spans: tracer.spans,
        phases,
      };
    } catch (e) {
      if (this.graphDeps) {
        this.graphDeps.tracer = undefined;
        this.graphDeps.onPhase = undefined;
      }
      turnSpan.end({
        status: "error",
        error: e instanceof Error ? e.message : String(e),
      });
      throw e;
    }
  }

  private getCompiled(): { compiled: CompiledOrchestratorGraph; deps: OrchestratorGraphDeps } {
    if (this.compiled && this.graphDeps) {
      return { compiled: this.compiled, deps: this.graphDeps };
    }
    const deps: OrchestratorGraphDeps = {
      memory: this.memory,
      registry: this.buildRegistry(),
      strategicContext: this.strategicContext,
      tracer: undefined as TurnTracer | undefined,
      onPhase: undefined as PhaseListener | undefined,
    };
    this.graphDeps = deps;
    this.compiled = buildOrchestratorGraph(deps);
    return { compiled: this.compiled, deps };
  }

  private buildRegistry(): SkillRegistry {
    const registry = new SkillRegistry();

    registry.register("research", async (state, args) => {
      const depth = args.depth === "full" ? "full" : "lite";
      const topic = resolveResearchTopic(state);
      const post_format = isPostFormat(state.slots.post_format) ? state.slots.post_format : undefined;
      const onPhase = this.graphDeps?.onPhase;
      const first_party = await this.firstPartyPriors.load(state.workspace_id, topic).catch(() => undefined);
      const revise = args.revise === true;
      const result = await this.research.run({
        workspace_id: state.workspace_id,
        topic,
        depth,
        post_format,
        allow_guess: depth === "lite",
        personal_notes: topic,
        first_party,
        persist: true,
        created_by: state.user_id,
        thread_id: state.thread_id,
        onPhase,
        revise,
      });
      if (result.needs_clarification) {
        const q =
          result.research_brief.ambiguity.clarifying_question || "Which scope should research use before searching?";
        const opts = result.research_brief.ambiguity.options?.join(" / ");
        return {
          summary: `Research needs clarification: ${q}`,
          patch: {
            reply: opts ? `${q}\nOptions: ${opts}` : q,
            pending_question: q,
            slots: { ...state.slots, topic },
          },
        };
      }
      const keyInsights = (result.package as { key_insights?: string[] }).key_insights;
      return {
        summary: `Research ${depth}: ${result.summary.source_count} sources`,
        patch: {
          research_package_id: result.package.id,
          research_summary: result.summary,
          research_package: result.package,
          slots: { ...state.slots, topic },
          metadata: {
            ...(state.metadata ?? {}),
            ...(keyInsights?.length ? { research_key_insights: keyInsights } : {}),
          },
          artifacts_for_client: [{ kind: "research_package", id: result.package.id, title: result.package.topic }],
        },
      };
    });

    registry.register("writing", async (state, args) => {
      const action = args.action === "revise" ? "revise" : args.action === "outline" ? "outline" : "draft";
      // Prefer a real topic slot; never ground the outline on HITL button text.
      const topicFromSlot =
        typeof state.slots.topic === "string" && state.slots.topic.trim() ? state.slots.topic.trim() : undefined;
      const topicFromSummary =
        typeof state.research_summary?.topic === "string" && state.research_summary.topic.trim()
          ? state.research_summary.topic.trim()
          : undefined;
      const topicFromPkg =
        typeof state.research_package?.topic === "string" && state.research_package.topic.trim()
          ? state.research_package.topic.trim()
          : undefined;
      const topic = topicFromSlot || topicFromPkg || topicFromSummary || "the topic we researched";
      const post_format: PostFormat | undefined = isPostFormat(state.slots.post_format)
        ? state.slots.post_format
        : undefined;
      const userNarrative = (state.recent_messages ?? [])
        .filter((m) => m.role === "user")
        .map((m) => m.content.trim())
        .filter(Boolean)
        .filter((c) => !/^(approve|revise|modify|continue)\b/i.test(c))
        .slice(-8)
        .join("\n");
      const groundedPrompt = buildGroundedWritingPrompt({
        topic,
        userNarrative,
        format: post_format,
      });
      const slice = state.memory_views?.workspace_slice as
        | {
            brand_voice?: string;
            target_audience?: string[];
            business_goals?: string[];
          }
        | undefined;
      const prefs = state.memory_views?.preferences as
        | { tone?: string; target_audience?: string; word_count?: number }
        | undefined;
      const userParams = {
        tone: state.slots.tone ?? prefs?.tone ?? state.conversation_context?.tone_preference,
        target_audience: state.slots.target_audience ?? prefs?.target_audience ?? slice?.target_audience?.[0],
        word_count: state.slots.word_count ?? prefs?.word_count,
        context_pack:
          (typeof state.memory_views?.prompt_block === "string" && state.memory_views.prompt_block.trim()
            ? state.memory_views.prompt_block
            : undefined) ?? (slice?.brand_voice ? `brand_voice: ${slice.brand_voice}` : undefined),
        post_format,
      };
      let researchPackage = state.research_package;
      if (!researchPackage && state.research_package_id) {
        researchPackage =
          (await this.researchPackages
            .findById(state.workspace_id, state.research_package_id)
            .catch(() => null)) ?? undefined;
      }
      // #region agent log
      fetch("http://127.0.0.1:7845/ingest/3b4333d1-9478-4155-a0c2-6acee25e28ec", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "17457c" },
        body: JSON.stringify({
          sessionId: "17457c",
          runId: "post-fix",
          hypothesisId: "H-A",
          location: "orchestrator-v05-graph.service.ts:writing",
          message: "writing skill package hydrate",
          data: {
            action,
            topic,
            packageId: state.research_package_id ?? null,
            hadPackage: Boolean(state.research_package),
            hydrated: Boolean(researchPackage),
            factCount: researchPackage?.facts?.length ?? 0,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
      const result = await this.writing.run({
        action,
        workspace_id: state.workspace_id,
        topic,
        prompt: groundedPrompt,
        research_package_id: state.research_package_id ?? researchPackage?.id,
        research_package: researchPackage,
        draft: state.draft as { title: string; content: string; excerpt: string } | undefined,
        optimization_plan: state.optimization_plan,
        feedback: typeof args.feedback === "string" ? args.feedback : undefined,
        allow_without_package: action === "revise",
        userParams,
        post_format,
      });
      const patch: Partial<OrchestratorState> = {
        quality_gate_passed: action === "revise" ? undefined : state.quality_gate_passed,
        optimize_count: action === "revise" ? state.optimize_count + 1 : state.optimize_count,
        ...(researchPackage
          ? {
              research_package: researchPackage,
              research_package_id: state.research_package_id ?? researchPackage.id,
            }
          : {}),
        artifacts_for_client: result.draft
          ? [{ kind: "draft", id: state.research_package_id ?? "draft", title: result.draft.title }]
          : result.outline
            ? [{ kind: "outline", id: state.research_package_id ?? "outline", title: result.outline.title }]
            : [],
      };
      if (result.outline) {
        patch.outline = result.outline as unknown as Record<string, unknown>;
        patch.metadata = { ...(state.metadata ?? {}), writing_checkpoint: "outline" };
      }
      if (result.draft) {
        const existingBlogId =
          (typeof state.metadata?.blog_id === "string" && state.metadata.blog_id) ||
          (typeof (state.draft as DraftRecord | undefined)?.blog_id === "string" &&
            (state.draft as DraftRecord).blog_id) ||
          undefined;

        let blogId = existingBlogId;
        if (existingBlogId) {
          await this.blogService.updateBlog(existingBlogId, state.workspace_id, state.user_id, {
            title: result.draft.title,
            content: result.draft.content,
            excerpt: result.draft.excerpt,
            meta: result.draft.meta,
          });
        } else {
          const created = await this.blogService.createBlog(state.user_id, state.workspace_id, {
            title: result.draft.title,
            content: result.draft.content,
            excerpt: result.draft.excerpt,
            meta: result.draft.meta,
            status: BlogStatus.DRAFT,
            campaign_id: state.campaign_id,
          });
          blogId = created._id?.toString();
        }

        patch.draft = {
          ...result.draft,
          ...(blogId ? { blog_id: blogId } : {}),
        } as unknown as Record<string, unknown>;
        if (blogId) {
          patch.metadata = {
            ...(state.metadata ?? {}),
            blog_id: blogId,
          };
          patch.artifacts_for_client = [{ kind: "draft", id: blogId, title: result.draft.title }];
        }
        if (action === "revise") {
          patch.reply = `Updated “${result.draft.title}” from your feedback. The full revised draft is in the results panel.`;
        }
      }
      return {
        summary: `Writing ${action}`,
        patch,
      };
    });

    registry.register("content_optimization", async (state) => {
      const draft = state.draft as
        | { title?: string; content?: string; excerpt?: string; meta?: { description?: string } }
        | undefined;
      if (!draft?.title || !draft.content) {
        throw new Error("content_optimization requires draft title+content");
      }
      const post_format = isPostFormat(state.slots.post_format) ? state.slots.post_format : undefined;
      const result = await this.optimize.run({
        draft: {
          title: draft.title,
          content: draft.content,
          excerpt: draft.excerpt,
          meta_description: draft.meta?.description ?? draft.excerpt,
        },
        research_package_id: state.research_package_id,
        topic: state.slots.topic,
        workspace_id: state.workspace_id,
        persist: true,
        created_by: state.user_id,
        thread_id: state.thread_id,
        optimize_count: state.optimize_count,
        post_format,
        onPhase: this.graphDeps?.onPhase,
      });
      return {
        summary: `Optimize gate ${result.report.quality_gate_passed ? "passed" : "failed"} (${result.report.quality.overall})`,
        patch: {
          optimization_report_id: result.report.id,
          optimization_plan: result.report.plan,
          quality_gate_passed: result.report.quality_gate_passed,
          metadata: {
            ...(state.metadata ?? {}),
            quality_scores: {
              seo: result.report.quality.seo,
              gao: result.report.quality.gao,
              overall: result.report.quality.overall,
              authority: result.report.quality.authority,
              readability: result.report.quality.readability,
            },
          },
          artifacts_for_client: [{ kind: "optimization_report", id: result.report.id, title: "Optimization" }],
        },
      };
    });

    registry.register("content_strategy", async (state) => {
      const topic = state.slots.topic ?? state.message;
      const post_format = isPostFormat(state.slots.post_format) ? state.slots.post_format : undefined;
      const slice = state.memory_views?.workspace_slice as
        | {
            brand_voice?: string;
            target_audience?: string[];
            business_goals?: string[];
          }
        | undefined;
      const artifact = this.strategy.propose({
        topic,
        post_format,
        workspace_hints: {
          brand_voice: slice?.brand_voice,
          target_audience: slice?.target_audience,
          business_goals: slice?.business_goals,
        },
      });
      return {
        summary: `Strategy: ${artifact.content_angle}`,
        patch: {
          strategy: artifact as unknown as Record<string, unknown>,
          artifacts_for_client: [{ kind: "strategy", id: artifact.id, title: artifact.topic }],
        },
      };
    });

    registry.register("conversation", async (state, args) => {
      const purposeRaw = typeof args.purpose === "string" ? args.purpose : "";
      const purpose =
        purposeRaw === "clarify" || purposeRaw === "explain" || purposeRaw === "summarize" || purposeRaw === "warn"
          ? purposeRaw
          : "casual";
      const metaPatch: Record<string, unknown> = { ...state.metadata };
      const campaignIntent =
        (typeof args.campaign_intent === "string" && args.campaign_intent) ||
        state.conversation_context?.workflow_intent;
      const campaignCollect =
        args.campaign_collect === true ||
        campaignIntent === "create_campaign" ||
        campaignIntent === "learn_campaign" ||
        campaignIntent === "update_campaign" ||
        campaignIntent === "discuss_campaign" ||
        campaignIntent === "campaign_content" ||
        campaignIntent === "campaign_performance";

      if (campaignCollect) {
        const prior = (metaPatch.campaign_draft as CampaignDraftSlots | undefined) ?? {};
        const slice = state.memory_views?.workspace_slice as
          | {
              brand_voice?: string;
              target_audience?: string[];
              business_goals?: string[];
            }
          | undefined;
        const step = advanceCampaignCollect(state.message, prior, {
          intent: String(campaignIntent ?? ""),
          hints: {
            brand_voice: slice?.brand_voice,
            target_audience: slice?.target_audience,
            business_goals: slice?.business_goals,
            suggested_theme: slice?.business_goals?.[0] || slice?.target_audience?.[0],
          },
        });
        if (step.status === "ask") {
          metaPatch.campaign_draft = step.slots;
          return {
            summary: "Conversation (campaign_collect)",
            patch: { reply: step.question, metadata: metaPatch },
          };
        }
        if (step.status === "confirm") {
          metaPatch.campaign_draft = step.slots;
          return {
            summary: "Conversation (campaign_confirm)",
            patch: { reply: step.summary, metadata: metaPatch },
          };
        }
        if (step.status === "discuss") {
          metaPatch.campaign_draft = step.slots;
          return {
            summary: "Conversation (campaign_discuss)",
            patch: { reply: step.reply, metadata: metaPatch },
          };
        }
        if (step.status === "create") {
          const created = await this.campaignService.createCampaign(
            state.user_id,
            state.workspace_id,
            step.payload
          );
          const campaignId = created._id?.toString();
          delete metaPatch.campaign_draft;
          metaPatch.created_campaign = {
            id: campaignId,
            campaign_id: campaignId,
            name: created.name,
            goal: created.goal,
            target_audience: created.target_audience,
            start_date: created.start_date,
            end_date: created.end_date,
            posting_frequency: created.posting_frequency,
          };
          return {
            summary: `Created campaign '${created.name}'`,
            patch: {
              reply: `Created campaign “${created.name}”. You can open it in the results panel or ask me to build a roadmap next.`,
              metadata: metaPatch,
              campaign_id: campaignId,
              artifacts_for_client: campaignId
                ? [{ kind: "campaign", id: campaignId, title: created.name }]
                : [],
            },
          };
        }
      }

      const slice = state.memory_views?.workspace_slice as
        | {
            brand_voice?: string;
            target_audience?: string[];
            business_goals?: string[];
          }
        | undefined;
      const factBits: string[] = [];
      if (slice?.brand_voice) factBits.push(`brand_voice: ${slice.brand_voice}`);
      if (slice?.target_audience?.length) {
        factBits.push(`audience: ${slice.target_audience.join(", ")}`);
      }
      if (slice?.business_goals?.length) {
        factBits.push(`goals: ${slice.business_goals.join(", ")}`);
      }
      if (state.slots.topic) factBits.push(`topic_slot: ${state.slots.topic}`);
      if (state.conversation_context?.clarification_question) {
        factBits.push(`ci_question: ${state.conversation_context.clarification_question}`);
      }
      if (state.strategy) {
        const angle = String((state.strategy as { content_angle?: string }).content_angle ?? "");
        const topic = String((state.strategy as { topic?: string }).topic ?? "");
        if (angle) factBits.push(`strategy_angle: ${angle}`);
        if (topic) factBits.push(`strategy_topic: ${topic}`);
      }
      const recent = state.recent_messages ?? [];
      if (recent.length) {
        factBits.push(
          "recent_conversation:\n" +
            recent
              .slice(-10)
              .map((m) => `${m.role}: ${m.content.slice(0, 400)}`)
              .join("\n")
        );
      }
      const sessionSummary =
        typeof state.memory_views?.session_summary === "string" ? state.memory_views.session_summary : "";
      if (sessionSummary.trim()) {
        factBits.push(`session_summary: ${sessionSummary.slice(0, 800)}`);
      }
      const steer = state.metadata?.voice_product_steer;
      if (typeof steer === "string" && steer.trim()) {
        factBits.push(steer.trim());
      }
      if (state.metadata?.voice_call === true) {
        factBits.push(buildVoiceConversationInstructions("casual", { userMessage: state.message }));
      }
      // Collect → confirm → execute pattern for strategy/schedule conversational stubs.
      factBits.push(
        "entity_pattern: For new campaigns/strategies/schedules, collect required fields one at a time, summarize, ask confirm, then execute."
      );
      const result = await this.conversation.run({
        purpose,
        user_message: state.message,
        clarification_question:
          (typeof args.question === "string" && args.question) || state.conversation_context?.clarification_question,
        facts: factBits.join("\n") || undefined,
        brand_voice: slice?.brand_voice,
      });
      if (typeof args.question === "string" && args.strategic) {
        if (String(args.question).includes("campaign")) {
          metaPatch.campaign_clarify_asked = true;
        } else {
          metaPatch.strategic_gap_asked = true;
        }
      }
      return {
        summary: `Conversation (${purpose})`,
        patch: { reply: result.reply, metadata: metaPatch },
      };
    });

    return registry;
  }
}
