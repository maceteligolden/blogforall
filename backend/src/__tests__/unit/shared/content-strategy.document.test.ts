import { describe, expect, it } from "@jest/globals";
import {
  documentHasSubstance,
  ensureContentStrategyCompleteness,
  parseContentStrategyDocument,
} from "../../../shared/types/content-strategy.document";

describe("contentStrategyDocument", () => {
  it("keeps substance after completeness roundtrip", () => {
    const document = ensureContentStrategyCompleteness(
      parseContentStrategyDocument({ north_star: { what_we_are: "A writing workspace" } })
    );
    expect(documentHasSubstance(parseContentStrategyDocument(document))).toBe(true);
  });
});
