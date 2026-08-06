import { injectable } from "tsyringe";
import { createChatOpenAI } from "../../../shared/ai/create-chat-openai";
import { HumanMessage } from "@langchain/core/messages";
import { z } from "zod";
import { env } from "../../../shared/config/env";
import { logger } from "../../../shared/utils/logger";
import { WorkspaceMemoryRepository } from "../../orchestrator/repositories/workspace-memory.repository";
import { BehavioralRuleService } from "./behavioral-rule.service";
import { SemanticMemoryService } from "./semantic-memory.service";
import { BusinessKnowledgeService } from "../../strategic-intelligence/services/business-knowledge.service";
import { FIELD_PATH_TO_KEY } from "../../strategic-intelligence/constants/business-knowledge.keys";

const extractionSchema = z.object({
  items: z.array(
    z.object({
      type: z.enum(["stable_fact", "preference", "idea", "noise"]),
      field_path: z.string().optional(),
      value: z.string().optional(),
      rule_text: z.string().optional(),
      rule_polarity: z.enum(["prefer", "avoid"]).optional(),
      importance: z.number().min(0).max(1).optional(),
    })
  ),
});

@injectable()
export class MemoryExtractionService {
  constructor(
    private readonly memoryRepository: WorkspaceMemoryRepository,
    private readonly behavioralRuleService: BehavioralRuleService,
    private readonly semanticMemoryService: SemanticMemoryService,
    private readonly businessKnowledge: BusinessKnowledgeService
  ) {}

  /**
   * Classify and persist memory signals from a completed turn. Best-effort;
   * failures are logged but do not block the chat response.
   */
  async processTurn(input: {
    siteId: string;
    userId: string;
    threadId: string;
    userMessage: string;
    assistantReply: string;
    sessionMode?: string;
  }): Promise<void> {
    if (!env.orchestrator.openaiApiKey) return;

    try {
      const memory = await this.memoryRepository.ensureForSite(input.siteId, input.userId);
      const chat = createChatOpenAI({
        apiKey: env.orchestrator.openaiApiKey,
        model: "gpt-4o-mini",
        timeout: 30_000,
        temperature: 0,
      });
      const structured = chat.withStructuredOutput(extractionSchema);
      const casualHint =
        input.sessionMode === "casual"
          ? "\nThis was a casual discovery conversation — prioritize audience, tone, goals, brand voice, and content preferences."
          : "";
      const prompt = `Extract durable memory items from this workspace chat turn. Ignore greetings and filler.${casualHint}

User: ${input.userMessage.slice(0, 2000)}
Assistant: ${input.assistantReply.slice(0, 2000)}

Classify each item:
- stable_fact: business audience, goals, tone (field_path like strategic.target_audience)
- preference: writing style rules (rule_text + rule_polarity)
- idea: insight worth recalling later
- noise: discard`;

      const out = await structured.invoke([new HumanMessage(prompt)]);
      const patch: Record<string, unknown> = {};
      const newRules = [...(memory.behavioral_rules ?? [])];
      let chunkCount = 0;

      for (const item of out.items ?? []) {
        if (item.type === "noise") continue;
        if (item.type === "stable_fact" && item.field_path && item.value) {
          const mapped =
            env.orchestrator.strategicIntelligenceEnabled &&
            (FIELD_PATH_TO_KEY[item.field_path] || FIELD_PATH_TO_KEY[item.field_path.replace(/^strategic\./, "")]);
          if (mapped) {
            await this.businessKnowledge.upsertFromFieldPath(input.siteId, input.userId, item.field_path, item.value, {
              source: "conversation",
              confidence: item.importance ?? 0.65,
            });
          } else {
            patch[item.field_path] = item.value;
          }
        }
        if (item.type === "preference" && item.rule_text) {
          newRules.push(
            this.behavioralRuleService.buildRule({
              ruleText: item.rule_text,
              category: "style",
              polarity: item.rule_polarity ?? "prefer",
              source: "inferred",
              confidence: item.importance ?? 0.7,
              evidenceRefs: [input.threadId],
            })
          );
        }
        if (item.type === "idea" && item.value && (item.importance ?? 0.5) >= env.memory.minImportanceScore) {
          if (chunkCount >= env.memory.maxChunksPerTurn) continue;
          await this.semanticMemoryService.storeChunk({
            siteId: input.siteId,
            sourceType: "conversation",
            sourceId: input.threadId,
            text: item.value,
            importanceScore: item.importance ?? 0.5,
            expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          });
          chunkCount++;
        }
      }

      const mergedRules = this.behavioralRuleService.mergeRules(memory.behavioral_rules ?? [], newRules);
      const hasRuleChanges = mergedRules.length !== (memory.behavioral_rules ?? []).length;

      if (Object.keys(patch).length || hasRuleChanges) {
        await this.memoryRepository.update(
          input.siteId,
          {
            ...(hasRuleChanges ? { behavioral_rules: mergedRules } : {}),
            ...patch,
          } as never,
          input.userId
        );
        await this.behavioralRuleService.logAudit({
          siteId: input.siteId,
          userId: input.userId,
          action: "extraction",
          patchKeys: [...Object.keys(patch), ...(hasRuleChanges ? ["behavioral_rules"] : [])],
          previousVersion: memory.version,
        });
      }
    } catch (e) {
      logger.warn(
        "Memory extraction failed",
        { error: (e as Error).message, siteId: input.siteId },
        "MemoryExtractionService"
      );
    }
  }
}
