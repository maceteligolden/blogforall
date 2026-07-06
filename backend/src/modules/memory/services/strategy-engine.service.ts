import { injectable } from "tsyringe";
import { createChatOpenAI } from "../../../shared/ai/create-chat-openai";
import { HumanMessage } from "@langchain/core/messages";
import { z } from "zod";
import { env } from "../../../shared/config/env";
import type { WorkspaceMemory } from "../../../shared/schemas/workspace-memory.schema";
import { WorkspaceMemoryRepository } from "../../orchestrator/repositories/workspace-memory.repository";
import { randomUUID } from "crypto";

const ideaSchema = z.object({
  ideas: z.array(
    z.object({
      title: z.string(),
      angle: z.string(),
      funnel_stage: z.enum(["awareness", "consideration", "conversion"]),
      effort: z.enum(["low", "medium", "high"]),
      confidence: z.number().min(0).max(1),
      rationale: z.string(),
    })
  ),
  themes: z.array(
    z.object({
      name: z.string(),
      pillar: z.string(),
      priority: z.number().min(1).max(5),
    })
  ),
  clusters: z.array(
    z.object({
      cluster_id: z.string(),
      topics: z.array(z.string()),
      cadence_hint: z.string().optional(),
    })
  ),
});

export interface StrategyIdea {
  title: string;
  angle: string;
  funnel_stage: "awareness" | "consideration" | "conversion";
  effort: "low" | "medium" | "high";
  confidence: number;
  rationale: string;
}

export interface CalendarSlot {
  scheduled_at: string;
  idea_title: string;
  objective: string;
  narrative_phase: string;
  auto_generate_prompt: string;
}

@injectable()
export class StrategyEngineService {
  constructor(private readonly memoryRepository: WorkspaceMemoryRepository) {}

  async generateStrategy(siteId: string, userId: string, options?: { horizonWeeks?: number }) {
    const memory = await this.memoryRepository.ensureForSite(siteId, userId);
    const horizonWeeks = options?.horizonWeeks ?? memory.strategy_state?.calendar_horizon_weeks ?? 4;

    const ideas = await this.generateIdeas(memory);
    const clusters = this.buildClusters(ideas, memory);
    const calendar = this.buildCalendar(ideas, horizonWeeks, memory);

    await this.memoryRepository.update(
      siteId,
      {
        strategy_state: {
          active_themes: ideas.themes,
          content_clusters: clusters,
          calendar_horizon_weeks: horizonWeeks,
          last_strategy_review_at: new Date(),
        },
      } as never,
      userId
    );

    return { ideas: ideas.ideas, themes: ideas.themes, clusters, calendar, horizon_weeks: horizonWeeks };
  }

  async getStrategy(siteId: string, userId: string) {
    const memory = await this.memoryRepository.ensureForSite(siteId, userId);
    return {
      strategy_state: memory.strategy_state,
      content_summary: memory.content_summary,
      memory_summary: memory.memory_summary,
    };
  }

  private async generateIdeas(memory: WorkspaceMemory) {
    if (!env.orchestrator.openaiApiKey) {
      return this.fallbackIdeas(memory);
    }

    try {
      const chat = createChatOpenAI({
        apiKey: env.orchestrator.openaiApiKey,
        model: env.orchestrator.supervisorModel,
        timeout: env.orchestrator.API_TIMEOUT,
        temperature: 0.4,
      });
      const structured = chat.withStructuredOutput(ideaSchema);
      const prompt = `Generate content strategy for this workspace.

Business: ${memory.strategic.business_type ?? "unknown"}
Audience: ${(memory.strategic.target_audience ?? []).join(", ") || "general"}
Goals: ${(memory.strategic.business_goals ?? []).join(", ") || "grow audience"}
Brand voice: ${memory.strategic.brand_voice ?? memory.preferences.tone ?? "professional"}
SEO priorities: ${(memory.strategic.seo_priorities ?? []).join(", ")}
Recent themes: ${memory.content_summary?.slice(0, 1500) ?? "none"}

Return 6-10 blog ideas, 3-5 themes, and 2-4 content clusters.`;

      return await structured.invoke([new HumanMessage(prompt)]);
    } catch {
      return this.fallbackIdeas(memory);
    }
  }

  private fallbackIdeas(memory: WorkspaceMemory) {
    const topics = memory.strategic.seo_priorities?.length
      ? memory.strategic.seo_priorities
      : memory.strategic.business_goals?.length
        ? memory.strategic.business_goals
        : ["Industry insights"];

    return {
      ideas: topics.slice(0, 6).map((t, i) => ({
        title: `${t} — deep dive`,
        angle: `Practical guide for ${(memory.strategic.target_audience ?? ["readers"])[0] ?? "readers"}`,
        funnel_stage: (i === 0 ? "awareness" : i < topics.length - 1 ? "consideration" : "conversion") as
          | "awareness"
          | "consideration"
          | "conversion",
        effort: "medium" as const,
        confidence: 0.6,
        rationale: `Aligned with workspace goal: ${t}`,
      })),
      themes: topics.slice(0, 3).map((t, i) => ({ name: t, pillar: t, priority: 3 - i })),
      clusters: [
        {
          cluster_id: randomUUID(),
          topics: topics.slice(0, 4),
          cadence_hint: memory.operational.publishing_cadence ?? "2x per week",
        },
      ],
    };
  }

  private buildClusters(
    generated: Awaited<ReturnType<StrategyEngineService["generateIdeas"]>>,
    _memory: WorkspaceMemory
  ) {
    if (generated.clusters?.length) return generated.clusters;
    return [
      {
        cluster_id: randomUUID(),
        topics: generated.ideas.map((i) => i.title).slice(0, 5),
        cadence_hint: "weekly",
      },
    ];
  }

  private buildCalendar(
    ideas: Awaited<ReturnType<StrategyEngineService["generateIdeas"]>>,
    horizonWeeks: number,
    memory: WorkspaceMemory
  ): CalendarSlot[] {
    const cadence = memory.operational.publishing_cadence ?? "2x per week";
    const postsPerWeek = cadence.includes("daily") ? 5 : cadence.includes("3") ? 3 : 2;
    const totalPosts = Math.min(ideas.ideas.length, postsPerWeek * horizonWeeks);
    const start = new Date();
    const msPerSlot = Math.floor((horizonWeeks * 7 * 86400000) / Math.max(1, totalPosts));

    return ideas.ideas.slice(0, totalPosts).map((idea, idx) => {
      const scheduled = new Date(start.getTime() + idx * msPerSlot + 86400000);
      const phase = idx === 0 ? "awareness" : idx < totalPosts - 1 ? "consideration" : "conversion";
      return {
        scheduled_at: scheduled.toISOString(),
        idea_title: idea.title,
        objective: idea.rationale,
        narrative_phase: phase,
        auto_generate_prompt: `Write a blog post: ${idea.title}. Angle: ${idea.angle}. Audience: ${(memory.strategic.target_audience ?? []).join(", ")}`,
      };
    });
  }
}
