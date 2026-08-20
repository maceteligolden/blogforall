import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { SiteService } from "../../../../modules/site/services/site.service";
import { SiteStatus } from "../../../../shared/constants";

describe("SiteService.ensureDefaultWorkspace", () => {
  const existing = {
    _id: "s1",
    name: "Acme",
    website_url: "https://old.example",
    owner: "u1",
    status: SiteStatus.ACTIVE,
  };

  let findByOwner: jest.Mock;
  let findByUser: jest.Mock;
  let update: jest.Mock;
  let createWithOwner: jest.Mock;
  let createGeneratingStub: jest.Mock;
  let startBackgroundGenerate: jest.Mock;
  let service: SiteService;

  beforeEach(() => {
    findByOwner = jest.fn();
    findByUser = jest.fn();
    update = jest.fn();
    createWithOwner = jest.fn();
    createGeneratingStub = jest.fn(async () => ({}));
    startBackgroundGenerate = jest.fn();
    service = new SiteService(
      {
        findByOwner,
        findByUser,
        update,
        createWithOwner,
      } as never,
      {} as never,
      { getActiveSubscription: jest.fn(async () => ({ plan: { limits: { maxSitesAllowed: -1 } } })) } as never,
      { createGeneratingStub, startBackgroundGenerate } as never,
      { seedFromWorkspaceMemory: jest.fn(async () => undefined) } as never,
      { findById: jest.fn(async () => ({ onboarding_completed: false })) } as never
    );
  });

  it("creates a workspace with the given URL when the user has none", async () => {
    findByOwner.mockResolvedValue([] as never);
    findByUser.mockResolvedValue([] as never);
    createWithOwner.mockResolvedValue({ _id: "s-new", name: "Acme", website_url: "https://acme.test" } as never);

    const result = await service.ensureDefaultWorkspace("u1", {
      name: "Acme",
      website_url: "https://acme.test",
    });

    expect(result.created).toBe(true);
    expect(createWithOwner).toHaveBeenCalledWith(
      "u1",
      expect.objectContaining({ name: "Acme", website_url: "https://acme.test" })
    );
    expect(startBackgroundGenerate).not.toHaveBeenCalled();
  });

  it("updates an existing workspace URL without starting background generate", async () => {
    findByOwner.mockResolvedValue([existing] as never);
    update.mockResolvedValue({ ...existing, website_url: "https://new.example" } as never);

    const result = await service.ensureDefaultWorkspace("u1", { website_url: "https://new.example" });

    expect(result.created).toBe(false);
    expect(result.site._id).toBe("s1");
    expect(createWithOwner).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith("s1", { website_url: "https://new.example" });
    expect(createGeneratingStub).toHaveBeenCalledWith("s1", "u1", "https://new.example");
    expect(startBackgroundGenerate).not.toHaveBeenCalled();
  });

  it("retries strategy stub when the same website URL is submitted again", async () => {
    findByOwner.mockResolvedValue([existing] as never);

    const result = await service.ensureDefaultWorkspace("u1", { website_url: "https://old.example" });

    expect(result.created).toBe(false);
    expect(update).not.toHaveBeenCalled();
    expect(createGeneratingStub).toHaveBeenCalledWith("s1", "u1", "https://old.example");
  });

  it("returns the existing workspace without creating when the body is empty", async () => {
    findByOwner.mockResolvedValue([existing] as never);

    const result = await service.ensureDefaultWorkspace("u1");

    expect(result).toEqual({ created: false, site: existing });
    expect(createWithOwner).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(createGeneratingStub).not.toHaveBeenCalled();
    expect(startBackgroundGenerate).not.toHaveBeenCalled();
  });
});
