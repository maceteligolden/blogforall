import { injectable } from "tsyringe";
import { z } from "zod";
import { TavilySearchService } from "../../../blog/ai/tavily-search.service";
import type {
  OrchestratorTool,
  OrchestratorToolInvocation,
  OrchestratorToolResult,
} from "../../interfaces/orchestrator.interface";
import { parseToolInput, truncateSummary } from "./_helpers";

const searchWebInputSchema = z.object({
  query: z.string().min(1).max(500),
});

@injectable()
export class SearchWebTool implements OrchestratorTool {
  name = "search.web";
  description =
    "Search the public web for current information, trends, statistics, or competitor content. Returns summarized snippets with source URLs. Use in research mode before recommending content.";
  requiresConfirmation = false;

  constructor(private readonly tavilySearch: TavilySearchService) {}

  async run(invocation: OrchestratorToolInvocation): Promise<OrchestratorToolResult> {
    const input = parseToolInput(searchWebInputSchema, invocation.input, this.name);
    const results = await this.tavilySearch.search(input.query);
    if (!results.length) {
      return {
        summary: "No web results found. Try a more specific query or check that web search is enabled.",
        data: { results: [] },
      };
    }
    const lines = results.map((r, i) => `${i + 1}. ${r.title} — ${r.snippet.slice(0, 300)} (${r.url})`);
    return {
      summary: truncateSummary(`Found ${results.length} web results:\n${lines.join("\n")}`),
      data: { results },
    };
  }
}
