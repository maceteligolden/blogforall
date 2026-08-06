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
    return {
      summary: truncateSummary(
        `Workspace memory v${memory.version}. Goals: ${(memory.strategic.business_goals || []).join(", ") || "(none)"}. Tone: ${memory.preferences.tone || "(unset)"}.`
      ),
      data: {
        strategic: memory.strategic,
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
      strategic: z
        .object({
          website_url: z.string().max(2048).optional(),
          business_type: z.string().max(200).optional(),
          target_audience: z.array(z.string()).max(20).optional(),
          brand_voice: z.string().max(1000).optional(),
          business_goals: z.array(z.string()).max(20).optional(),
          seo_priorities: z.array(z.string()).max(50).optional(),
          publishing_channels: z.array(z.string()).max(20).optional(),
          competitive_notes: z.string().max(4000).optional(),
        })
        .partial()
        .optional(),
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
  strategic: z.object({
    website_url: z.string().max(2048).optional(),
    business_type: z.string().min(1).max(200),
    target_audience: z.array(z.string().min(1)).min(1).max(20),
    brand_voice: z.string().min(1).max(1000),
    business_goals: z.array(z.string().min(1)).min(1).max(20),
    seo_priorities: z.array(z.string()).max(50).optional(),
    publishing_channels: z.array(z.string()).max(20).optional(),
    competitive_notes: z.string().max(4000).optional(),
  }),
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
    "Finalize workspace onboarding. Call this once you have captured business_type, target_audience, brand_voice, and business_goals. Writes the captured payload to workspace memory and unlocks the dashboard.";
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
    const strategic = {
      website_url: input.strategic.website_url,
      business_type: input.strategic.business_type,
      target_audience: input.strategic.target_audience,
      brand_voice: input.strategic.brand_voice,
      business_goals: input.strategic.business_goals,
      seo_priorities: input.strategic.seo_priorities ?? [],
      publishing_channels: input.strategic.publishing_channels ?? [],
      competitive_notes: input.strategic.competitive_notes,
    };
    const preferences = {
      tone: input.preferences?.tone,
      default_word_count: input.preferences?.default_word_count,
      communication_style: input.preferences?.communication_style,
    };

    if (env.orchestrator.strategicIntelligenceEnabled) {
      await this.businessKnowledge.applyStrategicPatch(
        invocation.siteId,
        invocation.userId,
        {
          strategic,
          preferences,
          memory_summary:
            input.memory_summary ||
            this.buildMemorySummary(input.strategic.business_type, input.strategic.business_goals),
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
        memory_summary:
          input.memory_summary ||
          this.buildMemorySummary(input.strategic.business_type, input.strategic.business_goals),
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
      summary: `Onboarding complete: '${input.strategic.business_type}' workspace is now active.`,
      data: {
        site_active: true,
        captured_goals: input.strategic.business_goals,
      },
    };
  }

  private buildMemorySummary(businessType: string, goals: string[]): string {
    const top = goals.slice(0, 3).join("; ");
    return `Business: ${businessType}. Top goals: ${top || "(none)"}.`;
  }
}
