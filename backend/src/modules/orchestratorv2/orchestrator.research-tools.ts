import { tool } from "langchain";
import { z } from "zod";
import { container } from "tsyringe";
import { ResearchGraphService } from "./research/research-graph.service";
import { ArtifactStoreService } from "../orchestrator/ai/memory/artifact-store.service";
import { RealtimeService, REALTIME_EVENTS } from "../../shared/realtime";
import type { ResearchDepth, ResearchPurpose } from "./research/research.types";

export type ResearchToolContext = {
  siteId: string;
  userId: string;
  threadId?: string;
};

function toolResult(summary: string, data: Record<string, unknown> = {}): string {
  return JSON.stringify({ summary, ...data });
}

function emitPhase(
  realtime: RealtimeService,
  ctx: ResearchToolContext,
  event: { phase: string; message: string; percent?: number },
) {
  if (!ctx.threadId) return;
  realtime.emitToUser(
    ctx.userId,
    REALTIME_EVENTS.ORCHESTRATOR_PHASE,
    {
      threadId: ctx.threadId,
      siteId: ctx.siteId,
      phase: event.phase,
      message: event.message,
      percent: event.percent,
      skill_id: "research",
    },
    { siteId: ctx.siteId },
  );
}

export function createResearchTools(ctx: ResearchToolContext) {
  const research = container.resolve(ResearchGraphService);
  const artifacts = container.resolve(ArtifactStoreService);
  const realtime = container.resolve(RealtimeService);

  const research_run = tool(
    async (input: {
      question: string;
      depth?: ResearchDepth;
      purpose?: ResearchPurpose;
    }) => {
      const question = input.question.trim();
      if (!question) {
        throw new Error("question is required");
      }
      const depth: ResearchDepth =
        input.depth === "lite" ? "lite" : input.depth === "full" ? "full" : "full";
      const result = await research.run({
        workspace_id: ctx.siteId,
        question,
        depth,
        purpose: input.purpose ?? "general",
        persist: true,
        created_by: ctx.userId,
        thread_id: ctx.threadId,
        onPhase: (event) => emitPhase(realtime, ctx, event),
      });
      return toolResult(result.spoken_summary || result.summary.topic, {
        package_id: result.package_id,
        report_markdown: result.report_markdown,
        spoken_summary: result.spoken_summary,
        findings: result.findings.map((f) => ({
          title: f.title,
          finding: f.finding,
          confidence: f.confidence,
          implication: f.implication,
        })),
        summary: result.summary,
        degraded: result.degraded,
      });
    },
    {
      name: "research_run",
      description:
        "Run evidence-driven web research. Returns a markdown report with findings, confidence, and sources. Use lite for campaign/strategy prep; full for research mode and post writing. Check long-term memory first; only call when the answer is missing, stale, or the user asked to research.",
      schema: z.object({
        question: z.string().min(1).max(2000),
        depth: z.enum(["lite", "full"]).optional(),
        purpose: z.enum(["general", "post", "campaign", "strategy", "discussion"]).optional(),
      }),
    },
  );

  const research_get = tool(
    async (input: { package_id: string }) => {
      const pkg = await artifacts.getResearchPackage(ctx.siteId, input.package_id.trim());
      if (!pkg) {
        throw new Error("Research package not found");
      }
      const extra = pkg as typeof pkg & { report_markdown?: string; spoken_summary?: string };
      return toolResult(extra.spoken_summary || pkg.topic, {
        package_id: pkg.id,
        report_markdown: extra.report_markdown || pkg.topic,
        spoken_summary: extra.spoken_summary || "",
        summary: {
          topic: pkg.topic,
          depth: pkg.depth,
          coverage_score: pkg.coverage.coverage_score,
          source_count: pkg.sources.length,
          contradiction_count: pkg.contradictions.length,
          degraded: pkg.degraded,
        },
        sources: pkg.references.slice(0, 12),
      });
    },
    {
      name: "research_get",
      description:
        "Retrieve a prior research package by id when the user asks why a conclusion was reached or wants the sources again.",
      schema: z.object({
        package_id: z.string().min(1),
      }),
    },
  );

  return [research_run, research_get];
}
