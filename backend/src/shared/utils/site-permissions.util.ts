import { SiteMemberRole } from "../constants";
import { ForbiddenError } from "../errors";

/** Workspace capabilities used for REST and orchestrator gating. */
export enum SiteCapability {
  CHAT = "chat",
  WRITE_CONTENT = "write_content",
  DESTRUCTIVE = "destructive",
  MANAGE_MEMBERS = "manage_members",
  MANAGE_WORKSPACE = "manage_workspace",
  DELETE_WORKSPACE = "delete_workspace",
}

const OWNER_ADMIN: SiteMemberRole[] = [SiteMemberRole.OWNER, SiteMemberRole.ADMIN];

/** Tools that mutate workspace settings (not content drafts). */
const MANAGE_WORKSPACE_TOOLS = new Set([
  "workspace.renameWorkspace",
  "workspace.updateMemory",
]);

/** Read-only orchestrator tools viewers may invoke. */
const VIEWER_READ_TOOL_PREFIXES = [
  "blogs.get",
  "blogs.list",
  "blogs.review",
  "categories.list",
  "categories.get",
  "workspace.getMemory",
  "search.",
  "strategy.",
  "campaigns.get",
  "campaigns.list",
  "campaigns.getProgressReport",
  "campaigns.getHealth",
  "scheduled.list",
  "scheduled.get",
];

function isViewerReadTool(toolName: string): boolean {
  return VIEWER_READ_TOOL_PREFIXES.some((prefix) =>
    prefix.endsWith(".") ? toolName.startsWith(prefix) : toolName === prefix
  );
}

function hasRoleCapability(role: SiteMemberRole | null, capability: SiteCapability): boolean {
  if (!role) return false;

  switch (capability) {
    case SiteCapability.CHAT:
      return true;
    case SiteCapability.WRITE_CONTENT:
      return role === SiteMemberRole.OWNER || role === SiteMemberRole.ADMIN || role === SiteMemberRole.EDITOR;
    case SiteCapability.DESTRUCTIVE:
      return OWNER_ADMIN.includes(role);
    case SiteCapability.MANAGE_MEMBERS:
      return OWNER_ADMIN.includes(role);
    case SiteCapability.MANAGE_WORKSPACE:
      return OWNER_ADMIN.includes(role);
    case SiteCapability.DELETE_WORKSPACE:
      return role === SiteMemberRole.OWNER;
    default:
      return false;
  }
}

export function hasSiteCapability(role: SiteMemberRole | null, capability: SiteCapability): boolean {
  return hasRoleCapability(role, capability);
}

export function assertSiteCapability(role: SiteMemberRole | null, capability: SiteCapability): void {
  if (!hasSiteCapability(role, capability)) {
    throw new ForbiddenError(`Your workspace role does not allow this action (${capability}).`);
  }
}

export function canChat(role: SiteMemberRole | null): boolean {
  return hasSiteCapability(role, SiteCapability.CHAT);
}

export function canWriteContent(role: SiteMemberRole | null): boolean {
  return hasSiteCapability(role, SiteCapability.WRITE_CONTENT);
}

export function canManageMembers(role: SiteMemberRole | null): boolean {
  return hasSiteCapability(role, SiteCapability.MANAGE_MEMBERS);
}

export function canRunDestructiveTool(role: SiteMemberRole | null, toolName: string, requiresConfirmation = false): boolean {
  if (!role) return false;
  if (requiresConfirmation || MANAGE_WORKSPACE_TOOLS.has(toolName)) {
    if (MANAGE_WORKSPACE_TOOLS.has(toolName)) {
      return hasSiteCapability(role, SiteCapability.MANAGE_WORKSPACE);
    }
    return hasSiteCapability(role, SiteCapability.DESTRUCTIVE);
  }
  return true;
}

/**
 * Whether a workspace member may invoke an orchestrator tool.
 */
export function canRunOrchestratorTool(
  role: SiteMemberRole | null,
  toolName: string,
  requiresConfirmation: boolean
): boolean {
  if (!role) return false;

  if (role === SiteMemberRole.VIEWER) {
    return isViewerReadTool(toolName);
  }

  if (role === SiteMemberRole.EDITOR) {
    if (requiresConfirmation || MANAGE_WORKSPACE_TOOLS.has(toolName)) {
      return false;
    }
    return true;
  }

  if (requiresConfirmation || MANAGE_WORKSPACE_TOOLS.has(toolName)) {
    return canRunDestructiveTool(role, toolName, requiresConfirmation);
  }

  return true;
}

export function filterToolsForRole<T extends { name: string; requiresConfirmation: boolean }>(
  tools: T[],
  role: SiteMemberRole | null
): T[] {
  return tools.filter((t) => canRunOrchestratorTool(role, t.name, t.requiresConfirmation));
}

export interface SiteCapabilitiesPayload {
  can_chat: boolean;
  can_write_content: boolean;
  can_delete_content: boolean;
  can_manage_members: boolean;
  can_manage_workspace: boolean;
  can_delete_workspace: boolean;
}

export function buildCapabilitiesPayload(role: SiteMemberRole | null): SiteCapabilitiesPayload {
  return {
    can_chat: canChat(role),
    can_write_content: canWriteContent(role),
    can_delete_content: hasSiteCapability(role, SiteCapability.DESTRUCTIVE),
    can_manage_members: canManageMembers(role),
    can_manage_workspace: hasSiteCapability(role, SiteCapability.MANAGE_WORKSPACE),
    can_delete_workspace: hasSiteCapability(role, SiteCapability.DELETE_WORKSPACE),
  };
}
