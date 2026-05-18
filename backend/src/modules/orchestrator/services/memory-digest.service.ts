import { injectable } from "tsyringe";
import * as cron from "node-cron";
import { createChatOpenAI } from "../../../shared/ai/create-chat-openai";
import { HumanMessage } from "@langchain/core/messages";
import { z } from "zod";
import { env } from "../../../shared/config/env";
import { logger } from "../../../shared/utils/logger";
import { OrchestratorMessageRole } from "../../../shared/schemas/orchestrator-message.schema";
import type { OrchestratorMessage } from "../../../shared/schemas/orchestrator-message.schema";
import { WorkspaceMemoryRepository } from "../repositories/workspace-memory.repository";
import { OrchestratorMessageRepository } from "../repositories/orchestrator-message.repository";
import { SiteRepository } from "../../site/repositories/site.repository";
import { TokenEnforcementService } from "../../token-ledger/services/token-enforcement.service";
import { TokenLedgerFeature } from "../../../shared/constants/token-ledger.constant";

const digestSchema = z.object({
  memory_summary: z
    .string()
    .describe("Concise bullets the supervisor should read every turn (max ~800 words)."),
  performance_digest: z
    .string()
    .describe("What the user accomplished with the orchestrator in this window; factual, no fluff."),
  content_themes: z
    .string()
    .describe("Topics, blog titles, categories, or campaigns mentioned in the transcript."),
});

type DigestModelOut = z.infer<typeof digestSchema>;

/**
 * Nightly hygiene: compress recent orchestrator transcripts into
 * `workspace_memory.memory_summary` / `performance_summary` / `content_summary`,
 * and prune any threads that still exceed the configured message cap.
 */
@injectable()
export class MemoryDigestService {
  private cronJob: cron.ScheduledTask | null = null;

  constructor(
    private readonly workspaceMemoryRepository: WorkspaceMemoryRepository,
    private readonly messageRepository: OrchestratorMessageRepository,
    private readonly siteRepository: SiteRepository,
    private readonly tokenEnforcement: TokenEnforcementService
  ) {}

  start(): void {
    if (this.cronJob) {
      logger.warn("Memory digest cron already running", {}, "MemoryDigestService");
      return;
    }
    const expression = env.orchestrator.memoryDigestCron;
    if (!cron.validate(expression)) {
      logger.error(
        "Invalid memory digest cron expression; service NOT started",
        new Error(`bad cron: ${expression}`),
        { expression },
        "MemoryDigestService"
      );
      return;
    }
    this.cronJob = cron.schedule(expression, () => {
      this.runOnce().catch((err) =>
        logger.error("Memory digest run failed", err as Error, {}, "MemoryDigestService")
      );
    });
    logger.info(`Memory digest scheduled (${expression})`, {}, "MemoryDigestService");
  }

  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      logger.info("Memory digest stopped", {}, "MemoryDigestService");
    }
  }

  /**
   * One full pass: digest the next batch of workspaces, then prune oversized
   * threads globally. Safe to call manually (e.g. tests).
   */
  async runOnce(): Promise<{
    sitesDigested: number;
    sitesSkipped: number;
    threadsPruned: number;
    messagesDeleted: number;
  }> {
    const maxSites = env.orchestrator.memoryDigestMaxSitesPerRun;
    const lookbackMs = env.orchestrator.memoryDigestLookbackHours * 60 * 60 * 1000;
    const since = new Date(Date.now() - lookbackMs);

    let sitesDigested = 0;
    let sitesSkipped = 0;

    if (!env.orchestrator.openaiApiKey) {
      logger.warn(
        "Memory digest: skipping LLM fold (no OpenAI API key); thread prune still runs",
        { component: "orchestrator", event: "memory_digest_skip_no_key" },
        "MemoryDigestService"
      );
    } else {
      const batch = await this.workspaceMemoryRepository.findBatchForDigest(maxSites);
      for (const row of batch) {
        try {
          const ok = await this.digestOneSite(row.site_id, row.memory_summary ?? "", row.content_summary ?? "", since);
          if (ok) sitesDigested += 1;
          else sitesSkipped += 1;
        } catch (e) {
          sitesSkipped += 1;
          logger.error(
            "Memory digest failed for site",
            e as Error,
            { component: "orchestrator", event: "memory_digest_site_error", siteId: row.site_id },
            "MemoryDigestService"
          );
        }
      }
    }

    const { threadsPruned, messagesDeleted } = await this.pruneOversizedThreads();

    logger.info(
      "Memory digest batch complete",
      {
        component: "orchestrator",
        event: "memory_digest_batch_complete",
        sitesDigested,
        sitesSkipped,
        threadsPruned,
        messagesDeleted,
      },
      "MemoryDigestService"
    );

    return { sitesDigested, sitesSkipped, threadsPruned, messagesDeleted };
  }

  private async digestOneSite(
    siteId: string,
    priorMemorySummary: string,
    priorContentSummary: string,
    since: Date
  ): Promise<boolean> {
    if (!env.orchestrator.openaiApiKey) {
      logger.warn(
        "Skipping memory digest: no OpenAI API key",
        { component: "orchestrator", event: "memory_digest_skip_no_key", siteId },
        "MemoryDigestService"
      );
      return false;
    }

    const recent = await this.messageRepository.listRecentForSite(siteId, since, 300);
    if (recent.length === 0) {
      return false;
    }

    const site = await this.siteRepository.findById(siteId);
    if (!site?.owner) {
      return false;
    }

    const chronological = [...recent].reverse();
    const transcript = this.formatTranscript(chronological);

    const dateKey = new Date().toISOString().slice(0, 10);
    const requestId = `cron:memory-digest:${siteId}:${dateKey}`;

    return this.tokenEnforcement.runWithReservation({
      userId: site.owner,
      siteId,
      feature: TokenLedgerFeature.MEMORY_DIGEST,
      requestId,
      estimate: {
        feature: TokenLedgerFeature.MEMORY_DIGEST,
        promptText: transcript,
        contextText: priorMemorySummary,
      },
      fn: async () => {
        return this.runDigestLlm(
          siteId,
          priorMemorySummary,
          priorContentSummary,
          transcript,
          chronological
        );
      },
    });
  }

  private async runDigestLlm(
    siteId: string,
    priorMemorySummary: string,
    priorContentSummary: string,
    transcript: string,
    _chronological: OrchestratorMessage[]
  ): Promise<boolean> {
    const chat = createChatOpenAI({
      apiKey: env.orchestrator.openaiApiKey,
      model: env.orchestrator.memoryDigestModel,
      timeout: env.orchestrator.API_TIMEOUT,
      temperature: 0.2,
    });
    const structured = chat.withStructuredOutput(digestSchema);

    const prompt = `You maintain long-term workspace memory for an AI orchestrator that helps users manage blogs, categories, and scheduled posts.

PRIOR memory_summary (may be empty — preserve still-true facts unless the transcript clearly supersedes them):
${priorMemorySummary || "(none)"}

PRIOR content_summary tail (themes already on file; extend, do not repeat verbatim):
${(priorContentSummary || "").slice(-2000) || "(none)"}

NEW TRANSCRIPT (oldest → newest, last ${env.orchestrator.memoryDigestLookbackHours}h):
${transcript}

Return JSON fields:
- memory_summary: dense bullets for the supervisor (topics, preferences, pending approvals, habits).
- performance_digest: what happened in this window (tools run, posts touched).
- content_themes: blog/category/campaign themes only.`;

    const out: DigestModelOut = await structured.invoke([new HumanMessage(prompt)]);

    const mergedContent = mergeContentSummary(priorContentSummary, out.content_themes);

    await this.workspaceMemoryRepository.update(siteId, {
      memory_summary: clamp(out.memory_summary, 4000),
      content_summary: mergedContent,
      performance_summary: {
        summary: clamp(out.performance_digest, 4000),
        last_summarized_at: new Date(),
      },
    });

    return true;
  }

  private formatTranscript(messages: OrchestratorMessage[]): string {
    const lines: string[] = [];
    for (const m of messages) {
      const role =
        m.role === OrchestratorMessageRole.USER
          ? "user"
          : m.role === OrchestratorMessageRole.ASSISTANT
            ? "assistant"
            : m.role === OrchestratorMessageRole.TOOL
              ? `tool:${m.tool_name || "?"}`
              : String(m.role);
      const body = (m.content || "").trim().replace(/\s+/g, " ");
      const snippet = body.length > 1200 ? `${body.slice(0, 1200)}…` : body;
      lines.push(`[${role}] ${snippet}`);
    }
    return lines.join("\n");
  }

  private async pruneOversizedThreads(): Promise<{ threadsPruned: number; messagesDeleted: number }> {
    const maxKeep = env.orchestrator.maxThreadMessages;
    const candidates = await this.messageRepository.findThreadsExceedingMessageCount(maxKeep, 500);
    let threadsPruned = 0;
    let messagesDeleted = 0;
    for (const { thread_id, site_id } of candidates) {
      const n = await this.messageRepository.pruneThreadToMaxKeep(thread_id, site_id, maxKeep);
      if (n > 0) {
        threadsPruned += 1;
        messagesDeleted += n;
      }
    }
    return { threadsPruned, messagesDeleted };
  }
}

function clamp(s: string, max: number): string {
  const t = (s || "").trim();
  return t.length <= max ? t : t.slice(0, max);
}

function mergeContentSummary(existing: string, addition: string): string {
  const a = (existing || "").trim();
  const b = (addition || "").trim();
  if (!b) return a.slice(0, 8000);
  const sep = "\n\n—\n\n";
  const combined = a ? `${a}${sep}${b}` : b;
  if (combined.length <= 8000) return combined;
  return combined.slice(combined.length - 8000);
}
