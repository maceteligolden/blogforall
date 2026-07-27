import { randomUUID } from "crypto";
import { injectable } from "tsyringe";
import { ConversationIntelligenceService } from "../conversation-intelligence/conversation-intelligence";
import { MemoryManagerService } from "../memory/manager/memory-manager";
import { ContentOptimizationService } from "../skills/content-optimization/content-optimization.service";
import { ResearchSkillService } from "../skills/research/research-skill.service";
import { SkillRegistry } from "../skills/registry";
import { ContentStrategyService } from "../skills/strategy/content-strategy.service";
import { WritingSkillService } from "../skills/writing/writing.service";
import {
  buildOrchestratorGraph,
  invokeTurn,
  type CompiledOrchestratorGraph,
} from "./orchestrator.graph";
import type { OrchestratorState } from "./state";
import type { WorkflowMode } from "../contracts/enums";

export type V05GraphTurnInput = {
  workspace_id: string;
  user_id: string;
  thread_id: string;
  message: string;
  mode?: WorkflowMode;
  recent_messages?: Array<{ role: "user" | "assistant"; content: string }>;
};

export type V05GraphTurnResult = {
  state: OrchestratorState;
  reply: string;
  tool_calls: Array<{ tool: string; summary: string; output_data?: unknown }>;
};

/**
 * v0.5 LangGraph turn runner (CI → graph). Used when ORCHESTRATOR_V05_GRAPH_ENABLED.
 */
@injectable()
export class OrchestratorV05GraphService {
  private compiled: CompiledOrchestratorGraph | null = null;

  constructor(
    private readonly ci: ConversationIntelligenceService,
    private readonly memory: MemoryManagerService,
    private readonly research: ResearchSkillService,
    private readonly writing: WritingSkillService,
    private readonly optimize: ContentOptimizationService,
    private readonly strategy: ContentStrategyService,
  ) {}

  async runTurn(input: V05GraphTurnInput): Promise<V05GraphTurnResult> {
    const conversation_context = await this.ci.analyze({
      message: input.message,
      workspace_id: input.workspace_id,
      user_id: input.user_id,
      thread_id: input.thread_id,
      recent_messages: input.recent_messages,
    });

    const compiled = this.getCompiled();
    const state = await invokeTurn(compiled, {
      turn_id: randomUUID(),
      thread_id: input.thread_id,
      workspace_id: input.workspace_id,
      user_id: input.user_id,
      message: input.message,
      conversation_context,
      mode: input.mode ?? "chat",
    });

    const tool_calls = state.progress_events
      .filter((e) => e.type === "invoke_skill")
      .map((e) => ({
        tool: String(e.meta?.skill_id ?? "skill"),
        summary: e.message ?? "skill",
        output_data: e.meta,
      }));

    return {
      state,
      reply: state.reply ?? "Done.",
      tool_calls,
    };
  }

  private getCompiled(): CompiledOrchestratorGraph {
    if (this.compiled) return this.compiled;
    const registry = this.buildRegistry();
    this.compiled = buildOrchestratorGraph({
      memory: this.memory,
      registry,
    });
    return this.compiled;
  }

  private buildRegistry(): SkillRegistry {
    const registry = new SkillRegistry();

    registry.register("research", async (state, args) => {
      const depth = args.depth === "full" ? "full" : "lite";
      const topic = state.slots.topic ?? state.message;
      const result = await this.research.run({
        workspace_id: state.workspace_id,
        topic,
        depth,
        persist: true,
        created_by: state.user_id,
        thread_id: state.thread_id,
      });
      return {
        summary: `Research ${depth}: ${result.summary.source_count} sources`,
        patch: {
          research_package_id: result.package.id,
          research_summary: result.summary,
          research_package: result.package,
          artifacts_for_client: [
            { kind: "research_package", id: result.package.id, title: result.package.topic },
          ],
        },
      };
    });

    registry.register("writing", async (state, args) => {
      const action = args.action === "revise" ? "revise" : args.action === "outline" ? "outline" : "draft";
      const topic = state.slots.topic ?? state.message;
      const result = await this.writing.run({
        action,
        workspace_id: state.workspace_id,
        topic,
        research_package_id: state.research_package_id,
        research_package: state.research_package,
        draft: state.draft as
          | { title: string; content: string; excerpt: string }
          | undefined,
        optimization_plan: state.optimization_plan,
        feedback: typeof args.feedback === "string" ? args.feedback : undefined,
      });
      return {
        summary: `Writing ${action}`,
        patch: {
          outline: result.outline,
          draft: result.draft,
          quality_gate_passed: action === "revise" ? undefined : state.quality_gate_passed,
          optimize_count:
            action === "revise" ? state.optimize_count + 1 : state.optimize_count,
          artifacts_for_client: result.draft
            ? [{ kind: "draft", id: state.research_package_id ?? "draft", title: result.draft.title }]
            : [],
        },
      };
    });

    registry.register("content_optimization", async (state) => {
      const draft = state.draft as
        | { title?: string; content?: string; excerpt?: string; meta?: { description?: string } }
        | undefined;
      if (!draft?.title || !draft.content) {
        throw new Error("content_optimization requires draft title+content");
      }
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
      });
      return {
        summary: `Optimize gate ${result.report.quality_gate_passed ? "passed" : "failed"} (${result.report.quality.overall})`,
        patch: {
          optimization_report_id: result.report.id,
          optimization_plan: result.report.plan,
          quality_gate_passed: result.report.quality_gate_passed,
          artifacts_for_client: [
            { kind: "optimization_report", id: result.report.id, title: "Optimization" },
          ],
        },
      };
    });

    registry.register("content_strategy", async (state) => {
      const topic = state.slots.topic ?? state.message;
      const slice = state.memory_views?.workspace_slice as
        | {
            brand_voice?: string;
            target_audience?: string[];
            business_goals?: string[];
          }
        | undefined;
      const artifact = this.strategy.propose({
        topic,
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
          artifacts_for_client: [
            { kind: "strategy", id: artifact.id, title: artifact.topic },
          ],
        },
      };
    });

    return registry;
  }
}
