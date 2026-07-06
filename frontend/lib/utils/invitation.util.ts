import type { SiteInvitation } from "@/lib/api/services/site-invitation.service";

export function isInvitationExpired(inv: SiteInvitation): boolean {
  if (inv.is_expired) return true;
  if (inv.status === "expired") return true;
  if (inv.status !== "pending") return false;
  return new Date(inv.expires_at) < new Date();
}

export function invitationStatusLabel(inv: SiteInvitation): string {
  if (isInvitationExpired(inv)) return "Expired";
  if (inv.status === "pending") return "Pending";
  return inv.status.charAt(0).toUpperCase() + inv.status.slice(1);
}

export function formatInvitationExpiry(inv: SiteInvitation): string {
  const expires = new Date(inv.expires_at);
  if (isInvitationExpired(inv)) {
    return `Expired ${expires.toLocaleDateString()} ${expires.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  }
  return `Expires ${expires.toLocaleDateString()} ${expires.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}
