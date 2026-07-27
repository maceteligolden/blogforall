import type { ResearchNote } from "../../../../blog/ai/types";
import type { ResearchPackage } from "../../contracts/research-package";

/** Map Research Package sources (+ fact snippets) into BlogGraph research notes. */
export function researchPackageToNotes(pkg: ResearchPackage): ResearchNote[] {
  return pkg.sources.map((s) => {
    const related = [
      ...pkg.facts,
      ...pkg.definitions,
      ...pkg.statistics,
      ...pkg.examples,
    ]
      .filter((f) => f.source_id === s.id)
      .map((f) => f.text)
      .slice(0, 2);
    const snippet =
      related.length > 0
        ? `${s.snippet ?? ""}\n${related.join("\n")}`.trim().slice(0, 1200)
        : (s.snippet ?? s.title).slice(0, 1200);
    return {
      url: s.url,
      title: s.title,
      snippet,
    };
  });
}
