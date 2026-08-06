import { injectable } from "tsyringe";
import type { WorkspaceMemory } from "../../../shared/schemas/workspace-memory.schema";
import EpisodicEpisodeModel from "../../../shared/schemas/episodic-episode.schema";
import { OrchestratorKnowledgeService } from "../../orchestrator/services/orchestrator-knowledge.service";
import { BehavioralRuleService } from "./behavioral-rule.service";
import { SemanticMemoryService } from "./semantic-memory.service";
import type { OrchestratorSessionMode } from "../../orchestrator/utils/turn-context.helper";
import { env } from "../../../shared/config/env";
import { migrateStrategicMemory } from "../../../shared/utils/migrate-strategic-memory";
import { formatBusinessOneLiner } from "../../../shared/utils/format-business-context";

export interface ContextPack {
  structured: string;
  behavioral: string;
  episodic: string;
  semantic: string;
  knowledge: string;
  calendar: string;
}

export interface ContextPackBuildInput {
  siteId: string;
  memory: WorkspaceMemory;
  userMessage: string;
  sessionMode?: OrchestratorSessionMode;
  includeVectors?: boolean;
}

@injectable()
export class ContextPackBuilderService {
  constructor(
    private readonly knowledgeService: OrchestratorKnowledgeService,
    private readonly behavioralRuleService: BehavioralRuleService,
    private readonly semanticMemoryService: SemanticMemoryService
  ) {}

  async build(input: ContextPackBuildInput): Promise<ContextPack> {
    const mode = input.sessionMode ?? "planning";
    const pack: ContextPack = {
      structured: "",
      behavioral: "",
      episodic: "",
      semantic: "",
      knowledge: "",
      calendar: "",
    };

    pack.structured = this.buildStructuredBlock(input.memory, mode);
    pack.behavioral = this.buildBehavioralBlock(input.memory, mode);
    pack.episodic = await this.buildEpisodicBlock(input.memory, mode);
    pack.knowledge = await this.buildKnowledgeBlock(input.siteId, mode);

    if (input.includeVectors !== false && this.modeUsesVectors(mode)) {
      const [semantic, knowledgeHits] = await Promise.all([
        this.semanticMemoryService.search({
          siteId: input.siteId,
          query: input.userMessage,
          limit: mode === "research" ? 8 : 5,
        }),
        this.semanticMemoryService.searchKnowledgeChunks(input.siteId, input.userMessage, mode === "research" ? 6 : 4),
      ]);
      pack.semantic = semantic.map((s) => `- (${s.source_type}) ${s.text.slice(0, 400)}`).join("\n");
      if (knowledgeHits.length) {
        const kbLines = knowledgeHits.map((k) => `- [doc:${k.source_id}] ${k.text.slice(0, 400)}`);
        pack.knowledge = [pack.knowledge, kbLines.join("\n")].filter(Boolean).join("\n");
      }
    }

    if (mode === "strategy" || mode === "planning") {
      pack.calendar = this.buildStrategyBlock(input.memory);
    }

    return pack;
  }

  toPromptBlock(pack: ContextPack): string {
    const sections: string[] = [];
    if (pack.structured) sections.push(`[BRAND & STRATEGY]\n${pack.structured}`);
    if (pack.behavioral) sections.push(`[WRITING RULES]\n${pack.behavioral}`);
    if (pack.episodic) sections.push(`[RECENT CONTEXT]\n${pack.episodic}`);
    if (pack.semantic) sections.push(`[RELEVANT IDEAS]\n${pack.semantic}`);
    if (pack.knowledge) sections.push(`[DOCUMENT SNIPPETS]\n${pack.knowledge}`);
    if (pack.calendar) sections.push(`[STRATEGY & CALENDAR]\n${pack.calendar}`);
    return sections.join("\n\n").slice(0, env.memory.contextPackTokenBudget * 4);
  }

  private buildStructuredBlock(memory: WorkspaceMemory, mode: OrchestratorSessionMode): string {
    const strategic = migrateStrategicMemory(memory.strategic);

    if (mode === "casual") {
      const oneLiner = formatBusinessOneLiner(strategic);
      const lines = [
        oneLiner && oneLiner !== "unknown" ? `Business: ${oneLiner}` : "",
        memory.preferences.tone ? `Tone: ${memory.preferences.tone}` : "",
        memory.memory_summary?.trim() ? `Summary: ${memory.memory_summary.trim().slice(0, 800)}` : "",
      ].filter(Boolean);
      return lines.join("\n");
    }

    const snapshot = {
      strategic,
      preferences: memory.preferences,
      operational:
        mode === "strategy" || mode === "planning"
          ? {
              publishing_cadence: memory.operational.publishing_cadence,
              review_lead_time_hours: memory.operational.review_lead_time_hours,
            }
          : undefined,
    };
    return JSON.stringify(snapshot, null, 2).slice(0, 3000);
  }

  private buildBehavioralBlock(memory: WorkspaceMemory, mode: OrchestratorSessionMode): string {
    if (mode === "casual") {
      const rules = this.behavioralRuleService.getActiveRules(memory, 5);
      return this.behavioralRuleService.formatRulesForContext(rules);
    }
    const limit = mode === "writing" || mode === "review" ? 20 : 10;
    const rules = this.behavioralRuleService.getActiveRules(memory, limit);
    return this.behavioralRuleService.formatRulesForContext(rules);
  }

  private async buildEpisodicBlock(memory: WorkspaceMemory, mode: OrchestratorSessionMode): Promise<string> {
    if (mode === "casual") return "";
    const lines: string[] = [];
    if (memory.memory_summary?.trim()) {
      lines.push(`Summary: ${memory.memory_summary.trim()}`);
    }
    if (mode !== "writing" && memory.content_summary?.trim()) {
      lines.push(`Content themes: ${memory.content_summary.trim().slice(0, 1500)}`);
    }
    if (memory.performance_summary?.summary?.trim()) {
      lines.push(`Performance: ${memory.performance_summary.summary.trim().slice(0, 1000)}`);
    }

    if (mode === "strategy" || mode === "planning") {
      const episode = await EpisodicEpisodeModel.findOne({ site_id: memory.site_id }).sort({ period_end: -1 }).lean();
      if (episode?.summary) {
        lines.push(`Latest episode: ${episode.summary.slice(0, 1500)}`);
      }
    }
    return lines.join("\n");
  }

  private async buildKnowledgeBlock(siteId: string, mode: OrchestratorSessionMode): Promise<string> {
    if (mode === "casual") return "";
    return this.knowledgeService.buildKnowledgeSummary(siteId);
  }

  private buildStrategyBlock(memory: WorkspaceMemory): string {
    const state = memory.strategy_state;
    if (!state) return "";
    const lines: string[] = [];
    if (state.active_themes?.length) {
      lines.push(`Active themes: ${state.active_themes.map((t) => t.name).join(", ")}`);
    }
    if (state.content_clusters?.length) {
      for (const c of state.content_clusters.slice(0, 5)) {
        lines.push(`Cluster ${c.cluster_id}: ${c.topics.slice(0, 5).join(", ")}`);
      }
    }
    lines.push(`Planning horizon: ${state.calendar_horizon_weeks ?? 4} weeks`);
    return lines.join("\n");
  }

  private modeUsesVectors(mode: OrchestratorSessionMode): boolean {
    return mode === "research" || mode === "writing" || mode === "strategy" || mode === "planning";
  }
}
