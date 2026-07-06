import { describe, expect, it } from "@jest/globals";
import { SiteMemberRole } from "../shared/constants";
import {
  SiteCapability,
  canRunOrchestratorTool,
  hasSiteCapability,
} from "../shared/utils/site-permissions.util";

describe("site-permissions.util", () => {
  it("allows editors to write content but not delete", () => {
    expect(hasSiteCapability(SiteMemberRole.EDITOR, SiteCapability.WRITE_CONTENT)).toBe(true);
    expect(hasSiteCapability(SiteMemberRole.EDITOR, SiteCapability.DESTRUCTIVE)).toBe(false);
    expect(hasSiteCapability(SiteMemberRole.EDITOR, SiteCapability.MANAGE_MEMBERS)).toBe(false);
  });

  it("allows admins destructive actions but only owners can delete workspace", () => {
    expect(hasSiteCapability(SiteMemberRole.ADMIN, SiteCapability.DESTRUCTIVE)).toBe(true);
    expect(hasSiteCapability(SiteMemberRole.ADMIN, SiteCapability.DELETE_WORKSPACE)).toBe(false);
    expect(hasSiteCapability(SiteMemberRole.OWNER, SiteCapability.DELETE_WORKSPACE)).toBe(true);
  });

  it("restricts viewers to read-only orchestrator tools", () => {
    expect(canRunOrchestratorTool(SiteMemberRole.VIEWER, "blogs.get", false)).toBe(true);
    expect(canRunOrchestratorTool(SiteMemberRole.VIEWER, "blogs.list", false)).toBe(true);
    expect(canRunOrchestratorTool(SiteMemberRole.VIEWER, "blogs.update", false)).toBe(false);
    expect(canRunOrchestratorTool(SiteMemberRole.VIEWER, "blogs.delete", true)).toBe(false);
  });

  it("blocks editors from destructive and workspace management tools", () => {
    expect(canRunOrchestratorTool(SiteMemberRole.EDITOR, "blogs.update", false)).toBe(true);
    expect(canRunOrchestratorTool(SiteMemberRole.EDITOR, "blogs.delete", true)).toBe(false);
    expect(canRunOrchestratorTool(SiteMemberRole.EDITOR, "blogs.unpublish", true)).toBe(false);
    expect(canRunOrchestratorTool(SiteMemberRole.EDITOR, "workspace.renameWorkspace", false)).toBe(false);
  });

  it("allows owners to run destructive tools", () => {
    expect(canRunOrchestratorTool(SiteMemberRole.OWNER, "blogs.delete", true)).toBe(true);
    expect(canRunOrchestratorTool(SiteMemberRole.OWNER, "workspace.renameWorkspace", false)).toBe(true);
  });
});
