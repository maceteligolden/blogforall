import { describe, expect, it } from "@jest/globals";
import { isWebsiteIngestFailure } from "../../../../modules/onboarding/utils/website-ingest-failure";

describe("isWebsiteIngestFailure", () => {
  it("matches a missing website URL", () => {
    expect(isWebsiteIngestFailure("Add a website URL to generate Content Strategy.")).toBe(true);
  });

  it("matches an unreadable website", () => {
    expect(isWebsiteIngestFailure("Could not read that website. Check the URL and try again.")).toBe(true);
  });

  it("does not match other strategy errors", () => {
    expect(isWebsiteIngestFailure("Content strategy generation failed")).toBe(false);
    expect(isWebsiteIngestFailure(undefined)).toBe(false);
  });
});
