import { injectable } from "tsyringe";
import { z } from "zod";
import { SiteService } from "../../../site/services/site.service";
import { WorkspaceMemoryRepository } from "../../repositories/workspace-memory.repository";
import { OrchestratorApprovalKind } from "../../../../shared/schemas/orchestrator-approval.schema";
import type {
  OrchestratorTool,
  OrchestratorToolInvocation,
  OrchestratorToolResult,
} from "../../interfaces/orchestrator.interface";
import { parseToolInput, truncateSummary } from "./_helpers";
import { CampaignService } from "../../../campaign/services/campaign.service";
import { BusinessKnowledgeService } from "../../../strategic-intelligence/services/business-knowledge.service";
import { WorkspaceStrategyService } from "../../../strategic-intelligence/services/workspace-strategy.service";
import { env } from "../../../../shared/config/env";
import {
  completeOnboardingStrategicSchema,
  strategicPatchSchema,
} from "../../../../shared/validations/business-profile.validation";
import { formatBusinessOneLiner } from "../../../../shared/utils/format-business-context";
import { migrateStrategicMemory } from "../../../../shared/utils/migrate-strategic-memory";
import { normalizeCompetitors, normalizeCustomers } from "../../../../shared/types/business-profile";

// -----------------------------------------------------------------------------
// workspace.renameWorkspace
// -----------------------------------------------------------------------------

const renameInputSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
});

@injectable()
export class WorkspaceRenameTool implements OrchestratorTool {
  name = "workspace.renameWorkspace";
  description =
    "Rename the current workspace and/or update its short description. Provide at least one of name or description.";
  requiresConfirmation = false;
  constructor(private readonly siteService: SiteService) {}

  async run(invocation: OrchestratorToolInvocation): Promise<OrchestratorToolResult> {
    const input = parseToolInput(renameInputSchema, invocation.input, this.name);
    if (!input.name && input.description == null) {
      throw new Error("Provide at least one of name or description.");
    }
    const updated = await this.siteService.updateSite(invocation.siteId, invocation.userId, {
      name: input.name,
      description: input.description,
    });
    return {
      summary: `Renamed workspace to '${updated.name}'.`,
      data: { id: updated._id, name: updated.name, description: updated.description },
    };
  }
}

// -----------------------------------------------------------------------------
// workspace.getMemory
// -----------------------------------------------------------------------------

@injectable()
export class WorkspaceGetMemoryTool implements OrchestratorTool {
  name = "workspace.getMemory";
  description =
    "Return the current workspace's strategic, operational, and preference memory. Use this to ground recommendations.";
  requiresConfirmation = false;
  constructor(private readonly memoryRepository: WorkspaceMemoryRepository) {}

  async run(invocation: OrchestratorToolInvocation): Promise<OrchestratorToolResult> {
    const memory = await this.memoryRepository.ensureForSite(invocation.siteId);
    const strategic = migrateStrategicMemory(memory.strategic);
    return {
      summary: truncateSummary(
        `Workspace memory v${memory.version}. Goals: ${(strategic.business_goals || []).join(", ") || "(none)"}. Tone: ${memory.preferences.tone || "(unset)"}.`
      ),
      data: {
        strategic,
        operational: memory.operational,
        preferences: memory.preferences,
        memory_summary: memory.memory_summary,
        version: memory.version,
      },
    };
  }
}

// -----------------------------------------------------------------------------
// workspace.updateMemory
// -----------------------------------------------------------------------------

const updateMemoryInputSchema = z.object({
  patch: z
    .object({
      strategic: strategicPatchSchema.optional(),
      operational: z
        .object({
          publishing_cadence: z.string().max(200).optional(),
          review_lead_time_hours: z
            .number()
            .min(1)
            .max(24 * 14)
            .optional(),
          approval_rules: z
            .object({
              publish_blog_requires_approval: z.boolean().optional(),
              delete_content_requires_approval: z.boolean().optional(),
              update_brand_guidelines_requires_approval: z.boolean().optional(),
              create_category_requires_approval: z.boolean().optional(),
              auto_execute_low_risk: z.boolean().optional(),
            })
            .partial()
            .optional(),
        })
        .partial()
        .optional(),
      preferences: z
        .object({
          tone: z.string().max(200).optional(),
          formatting: z.string().max(500).optional(),
          communication_style: z.string().max(500).optional(),
          default_word_count: z.number().min(300).max(8000).optional(),
        })
        .partial()
        .optional(),
      memory_summary: z.string().max(4000).optional(),
    })
    .partial(),
});

@injectable()
export class WorkspaceUpdateMemoryTool implements OrchestratorTool {
  name = "workspace.updateMemory";
  description =
    "Apply a partial patch to the workspace's strategic/preferences/operational/memory_summary fields. The patch only touches fields you include.";
  requiresConfirmation = false;
  constructor(
    private readonly memoryRepository: WorkspaceMemoryRepository,
    private readonly businessKnowledge: BusinessKnowledgeService
  ) {}

  async run(invocation: OrchestratorToolInvocation): Promise<OrchestratorToolResult> {
    const input = parseToolInput(updateMemoryInputSchema, invocation.input, this.name);
    const hasStrategicOrPrefs = !!(input.patch.strategic || input.patch.preferences);

    if (env.orchestrator.strategicIntelligenceEnabled && hasStrategicOrPrefs) {
      const updated = await this.businessKnowledge.applyStrategicPatch(
        invocation.siteId,
        invocation.userId,
        {
          strategic: input.patch.strategic as Record<string, unknown> | undefined,
          preferences: input.patch.preferences as Record<string, unknown> | undefined,
        },
        "conversation"
      );
      const residual = this.buildMongoPatch({
        operational: input.patch.operational,
        memory_summary: input.patch.memory_summary,
      });
      let version = updated?.version;
      if (Object.keys(residual).length > 0) {
        const mem = await this.memoryRepository.update(invocation.siteId, residual as never, invocation.userId);
        version = mem?.version ?? version;
      }
      if (version == null) {
        throw new Error("Workspace memory not found for this site.");
      }
      return {
        summary: `Updated workspace memory (v${version}) via business knowledge.`,
        data: { version, updated_keys: Object.keys(input.patch) },
      };
    }

    const patch = this.buildMongoPatch(input.patch);
    if (Object.keys(patch).length === 0) {
      return { summary: "No memory changes provided; nothing to update." };
    }
    const updated = await this.memoryRepository.update(invocation.siteId, patch as never, invocation.userId);
    if (!updated) {
      throw new Error("Workspace memory not found for this site.");
    }
    return {
      summary: `Updated workspace memory (v${updated.version}). Fields changed: ${Object.keys(patch).join(", ")}.`,
      data: { version: updated.version, updated_keys: Object.keys(patch) },
    };
  }

  /**
   * Convert a typed deep patch into Mongo dot-path $set updates so partial
   * fields inside `strategic`, `preferences`, etc. don't clobber siblings.
   */
  private buildMongoPatch(patch: z.infer<typeof updateMemoryInputSchema>["patch"]): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    if (patch.strategic) {
      for (const [k, v] of Object.entries(patch.strategic)) {
        if (v !== undefined) out[`strategic.${k}`] = v;
      }
    }
    if (patch.preferences) {
      for (const [k, v] of Object.entries(patch.preferences)) {
        if (v !== undefined) out[`preferences.${k}`] = v;
      }
    }
    if (patch.operational) {
      for (const [k, v] of Object.entries(patch.operational)) {
        if (v === undefined) continue;
        if (k === "approval_rules" && v && typeof v === "object") {
          for (const [rk, rv] of Object.entries(v as Record<string, unknown>)) {
            if (rv !== undefined) out[`operational.approval_rules.${rk}`] = rv;
          }
        } else {
          out[`operational.${k}`] = v;
        }
      }
    }
    if (patch.memory_summary !== undefined) {
      out.memory_summary = patch.memory_summary;
    }
    return out;
  }
}

// -----------------------------------------------------------------------------
// workspace.completeOnboarding (only callable in onboarding mode)
// -----------------------------------------------------------------------------

const completeOnboardingInputSchema = z.object({
  strategic: completeOnboardingStrategicSchema,
  preferences: z
    .object({
      tone: z.string().max(200).optional(),
      default_word_count: z.number().min(300).max(8000).optional(),
      communication_style: z.string().max(500).optional(),
    })
    .optional(),
  operational: z
    .object({
      publishing_cadence: z.string().max(200).optional(),
      review_lead_time_hours: z
        .number()
        .min(1)
        .max(24 * 14)
        .optional(),
    })
    .optional(),
  memory_summary: z.string().max(4000).optional(),
});

@injectable()
export class WorkspaceCompleteOnboardingTool implements OrchestratorTool {
  name = "workspace.completeOnboarding";
  description =
    "Finalize workspace onboarding. Call once you have captured business_description, at least one customer persona, brand_voice, and business_goals. Writes the captured payload to workspace memory and unlocks the dashboard.";
  // Onboarding is gated by site.status; no in-chat confirmation needed.
  requiresConfirmation = false;
  confirmationKind = OrchestratorApprovalKind.IN_CHAT_CONFIRMATION;

  constructor(
    private readonly siteService: SiteService,
    private readonly memoryRepository: WorkspaceMemoryRepository,
    private readonly campaignService: CampaignService,
    private readonly businessKnowledge: BusinessKnowledgeService,
    private readonly workspaceStrategy: WorkspaceStrategyService
  ) {}

  async run(invocation: OrchestratorToolInvocation): Promise<OrchestratorToolResult> {
    const input = parseToolInput(completeOnboardingInputSchema, invocation.input, this.name);
    const customers = normalizeCustomers(input.strategic.customers);
    const audienceLabels =
      input.strategic.target_audience?.length && input.strategic.target_audience.length > 0
        ? input.strategic.target_audience
        : customers.map((c) => c.label || c.who).filter(Boolean);
    const strategic = {
      website_url: input.strategic.website_url,
      industries: input.strategic.industries ?? [],
      business_model: input.strategic.business_model,
      business_description: input.strategic.business_description,
      target_audience: audienceLabels,
      customers,
      brand_voice: input.strategic.brand_voice,
      brand_negatives: input.strategic.brand_negatives,
      business_goals: input.strategic.business_goals,
      seo_priorities: input.strategic.seo_priorities ?? [],
      publishing_channels: input.strategic.publishing_channels ?? [],
      competitors: normalizeCompetitors(input.strategic.competitors ?? []),
    };
    const preferences = {
      tone: input.preferences?.tone,
      default_word_count: input.preferences?.default_word_count,
      communication_style: input.preferences?.communication_style,
    };
    const summary =
      input.memory_summary ||
      this.buildMemorySummary(input.strategic.business_description, input.strategic.business_goals);

    if (env.orchestrator.strategicIntelligenceEnabled) {
      await this.businessKnowledge.applyStrategicPatch(
        invocation.siteId,
        invocation.userId,
        {
          strategic,
          preferences,
          memory_summary: summary,
          ...(input.operational
            ? {
                operational: {
                  publishing_cadence: input.operational.publishing_cadence,
                  review_lead_time_hours: input.operational.review_lead_time_hours,
                },
              }
            : {}),
        },
        "onboarding"
      );
    } else {
      const patch: Record<string, unknown> = {
        strategic,
        preferences,
        memory_summary: summary,
      };
      if (input.operational) {
        patch.operational = {
          publishing_cadence: input.operational.publishing_cadence,
          review_lead_time_hours: input.operational.review_lead_time_hours,
        };
      }
      await this.memoryRepository.update(invocation.siteId, patch as never, invocation.userId);
    }
    await this.siteService.markSiteActive(invocation.siteId, invocation.userId);

    if (env.orchestrator.strategicIntelligenceEnabled) {
      await this.campaignService.ensureDefaultCampaign(invocation.siteId, invocation.userId);
      // Beliefs already written via applyStrategicPatch; seed fills any gaps from memory.
      await this.businessKnowledge.seedFromWorkspaceMemory(invocation.siteId, invocation.userId, "onboarding");
      await this.workspaceStrategy.generate(invocation.siteId, invocation.userId, {
        force: true,
        source: "onboarding",
      });
    }

    return {
      summary: `Onboarding complete: '${formatBusinessOneLiner(strategic)}' workspace is now active.`,
      data: {
        site_active: true,
        captured_goals: input.strategic.business_goals,
      },
    };
  }

  private buildMemorySummary(businessDescription: string, goals: string[]): string {
    const top = goals.slice(0, 3).join("; ");
    return `Business: ${businessDescription}. Top goals: ${top || "(none)"}.`;
  }
}
