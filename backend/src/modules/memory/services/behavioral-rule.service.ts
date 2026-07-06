import { injectable } from "tsyringe";
import { randomUUID } from "crypto";
import type { WorkspaceMemory } from "../../../shared/schemas/workspace-memory.schema";
import type { BehavioralRule, BehavioralRuleSource } from "../../../shared/schemas/memory-types";
import MemoryAuditLogModel from "../../../shared/schemas/memory-audit-log.schema";

@injectable()
export class BehavioralRuleService {
  getActiveRules(memory: WorkspaceMemory, limit = 10): BehavioralRule[] {
    return (memory.behavioral_rules ?? [])
      .filter((r) => !r.superseded_by)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, limit);
  }

  formatRulesForContext(rules: BehavioralRule[]): string {
    if (!rules.length) return "";
    return rules.map((r) => `- [${r.polarity}] ${r.rule_text} (${r.category})`).join("\n");
  }

  buildRule(input: {
    ruleText: string;
    category: BehavioralRule["category"];
    polarity: BehavioralRule["polarity"];
    source: BehavioralRuleSource;
    confidence?: number;
    evidenceRefs?: string[];
  }): BehavioralRule {
    return {
      rule_id: randomUUID(),
      category: input.category,
      rule_text: input.ruleText.trim().slice(0, 500),
      polarity: input.polarity,
      confidence: input.confidence ?? (input.source === "user_explicit" ? 0.95 : 0.7),
      source: input.source,
      evidence_refs: input.evidenceRefs ?? [],
      created_at: new Date(),
    };
  }

  mergeRules(existing: BehavioralRule[], incoming: BehavioralRule[]): BehavioralRule[] {
    const out = [...(existing ?? [])];
    for (const rule of incoming) {
      const conflictIdx = out.findIndex(
        (r) =>
          !r.superseded_by &&
          r.category === rule.category &&
          r.polarity === rule.polarity &&
          r.rule_text.toLowerCase() === rule.rule_text.toLowerCase()
      );
      if (conflictIdx >= 0) {
        if (rule.confidence >= out[conflictIdx].confidence) {
          out[conflictIdx] = { ...out[conflictIdx], superseded_by: rule.rule_id };
          out.push(rule);
        }
      } else {
        out.push(rule);
      }
    }
    return out;
  }

  async logAudit(input: {
    siteId: string;
    userId?: string;
    action: "patch" | "rule_add" | "rule_supersede" | "extraction" | "digest";
    patchKeys: string[];
    previousVersion?: number;
    newVersion?: number;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await MemoryAuditLogModel.create({
      site_id: input.siteId,
      user_id: input.userId,
      action: input.action,
      patch_keys: input.patchKeys,
      previous_version: input.previousVersion,
      new_version: input.newVersion,
      metadata: input.metadata,
      created_at: new Date(),
    });
  }
}
