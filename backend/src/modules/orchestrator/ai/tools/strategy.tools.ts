import { injectable } from "tsyringe";
import { z } from "zod";
import type {
  OrchestratorTool,
  OrchestratorToolInvocation,
  OrchestratorToolResult,
} from "../../interfaces/orchestrator.interface";
import { parseToolInput, truncateSummary } from "./_helpers";
import { StrategyEngineService } from "../../../memory/services/strategy-engine.service";

const proposeCalendarSchema = z.object({
  horizon_weeks: z.number().min(1).max(12).optional(),
});

@injectable()
export class StrategyProposeCalendarTool implements OrchestratorTool {
  name = "strategy.proposeCalendar";
  description =
    "Generate a content strategy with themed ideas and a proposed posting calendar for the workspace. Use in strategy or planning mode.";
  requiresConfirmation = false;

  constructor(private readonly strategyEngine: StrategyEngineService) {}

  async run(invocation: OrchestratorToolInvocation): Promise<OrchestratorToolResult> {
    const input = parseToolInput(proposeCalendarSchema, invocation.input, this.name);
    const result = await this.strategyEngine.generateStrategy(invocation.siteId, invocation.userId, {
      horizonWeeks: input.horizon_weeks,
    });
    return {
      summary: truncateSummary(
        `Generated ${result.ideas.length} ideas and ${result.calendar.length} calendar slots over ${result.horizon_weeks} weeks.`
      ),
      data: result,
    };
  }
}
