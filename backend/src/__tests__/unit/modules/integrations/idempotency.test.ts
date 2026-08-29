import { normalizeDestinations, publishIdempotencyKey } from "../../../../modules/integrations/idempotency";

describe("integration idempotency", () => {
  it("defaults destinations to bloggr", () => {
    expect(normalizeDestinations(undefined)).toEqual(["bloggr"]);
    expect(normalizeDestinations([])).toEqual(["bloggr"]);
  });

  it("dedupes and ignores unknown destinations", () => {
    expect(normalizeDestinations(["framer", "bloggr", "framer", "wordpress"])).toEqual(["framer", "bloggr"]);
  });

  it("builds a stable publish key", () => {
    expect(publishIdempotencyKey("framer", "site", "blog", "conn")).toBe("framer:publish:site:blog:conn");
  });
});
