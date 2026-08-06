import { z } from "zod";
import { createChatOpenAI } from "../../../../../shared/ai/create-chat-openai";
import { env } from "../../../../../shared/config/env";
import type { ResearchNoteLike } from "./build-package";

const extractedSchema = z.object({
  key_insights: z.array(z.string().min(1).max(220)).max(6).default([]),
  facts: z.array(z.string().min(1).max(280)).max(10).default([]),
  definitions: z.array(z.string().min(1).max(280)).max(6).default([]),
  statistics: z.array(z.string().min(1).max(220)).max(6).default([]),
});

export type SynthesizedResearchNotes = z.infer<typeof extractedSchema>;

function cleanRaw(text: string, max = 900): string {
  return text
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

/**
 * Turn raw Tavily snippets/extracts into concise blog-ready research notes.
 * Falls back to truncated snippets when the LLM is unavailable.
 */
export async function synthesizeResearchNotes(input: {
  topic: string;
  notes: ResearchNoteLike[];
  revise?: boolean;
}): Promise<{ notes: ResearchNoteLike[]; synthesized: SynthesizedResearchNotes; usedLlm: boolean }> {
  const sourcesBlock = input.notes
    .slice(0, 6)
    .map((n, i) => {
      const body = cleanRaw(n.claim || n.snippet || "");
      return `[${i + 1}] ${n.title}\nURL: ${n.url}\n${body}`;
    })
    .join("\n\n");

  const fallbackFacts = input.notes
    .map((n) => cleanRaw(n.snippet || n.claim || n.title, 180))
    .filter(Boolean)
    .slice(0, 8);

  const fallback: SynthesizedResearchNotes = {
    key_insights: fallbackFacts.slice(0, 4),
    facts: fallbackFacts,
    definitions: [],
    statistics: [],
  };

  const apiKey = env.orchestrator.openaiApiKey;
  if (!apiKey || !sourcesBlock.trim()) {
    return {
      notes: applySynthesizedToNotes(input.notes, fallback),
      synthesized: fallback,
      usedLlm: false,
    };
  }

  const prompt = [
    `You are a research analyst preparing notes for a blog post about: "${input.topic}".`,
    input.revise
      ? "The user asked to revise research — prefer fresher angles, counterpoints, and concrete examples not just a restatement."
      : "Extract useful notes a writer can cite.",
    "",
    "Rules:",
    "- Return ONLY valid JSON matching the schema.",
    "- Each string must be a self-contained note (1 sentence), max ~200 chars.",
    "- Do NOT paste website chrome, nav menus, cookie banners, or raw page dumps.",
    "- Prefer concrete facts, definitions, and statistics grounded in the sources.",
    "- If a source is thin, skip it rather than inventing.",
    "",
    'Schema: {"key_insights": string[], "facts": string[], "definitions": string[], "statistics": string[]}',
    "",
    "Sources:",
    sourcesBlock,
  ].join("\n");

  try {
    const chat = createChatOpenAI({
      apiKey,
      model: env.orchestrator.supervisorModel,
      temperature: 0.2,
      timeout: 25_000,
    });
    const res = await chat.invoke([{ role: "user", content: prompt }]);
    const text = typeof res.content === "string" ? res.content : JSON.stringify(res.content);
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const parsed = extractedSchema.safeParse(JSON.parse(jsonMatch?.[0] ?? "{}"));
    if (!parsed.success) {
      return {
        notes: applySynthesizedToNotes(input.notes, fallback),
        synthesized: fallback,
        usedLlm: false,
      };
    }
    const synthesized = parsed.data;
    if (synthesized.facts.length + synthesized.definitions.length + synthesized.statistics.length === 0) {
      return {
        notes: applySynthesizedToNotes(input.notes, fallback),
        synthesized: fallback,
        usedLlm: false,
      };
    }
    return {
      notes: applySynthesizedToNotes(input.notes, synthesized),
      synthesized,
      usedLlm: true,
    };
  } catch {
    return {
      notes: applySynthesizedToNotes(input.notes, fallback),
      synthesized: fallback,
      usedLlm: false,
    };
  }
}

function applySynthesizedToNotes(notes: ResearchNoteLike[], synthesized: SynthesizedResearchNotes): ResearchNoteLike[] {
  const claims = [
    ...synthesized.facts.map((t) => ({ text: t, kind: "fact" as const })),
    ...synthesized.definitions.map((t) => ({ text: t, kind: "definition" as const })),
    ...synthesized.statistics.map((t) => ({ text: t, kind: "statistic" as const })),
  ];
  if (!claims.length) {
    return notes.map((n) => ({
      ...n,
      claim: cleanRaw(n.snippet || n.claim || n.title, 180),
      snippet: cleanRaw(n.snippet || n.claim || "", 240),
    }));
  }

  // Keep source URLs; replace claims with synthesized notes (round-robin across sources).
  return claims.map((c, i) => {
    const src = notes[i % Math.max(1, notes.length)] ?? notes[0];
    return {
      url: src?.url || "",
      title: src?.title || `Note ${i + 1}`,
      snippet: c.text,
      claim: c.text,
      question_id: src?.question_id || `q${(i % 3) + 1}`,
      source_kind: (src?.source_kind || "extract") as ResearchNoteLike["source_kind"],
      kind: c.kind,
    };
  });
}
