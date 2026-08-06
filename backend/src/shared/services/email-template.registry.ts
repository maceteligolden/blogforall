import { EMAIL_TEMPLATE_KEYS, DEFAULT_EMAIL_LOCALE, type EmailTemplateKey } from "../constants/notification.constant";
import {
  EMAIL_COLORS,
  codeBlock,
  contentCard,
  disclaimer,
  escapeHtml,
  heading,
  muted,
  paragraph,
  primaryButton,
  wrapEmail,
} from "./email-theme";

export interface RenderedEmail {
  subject: string;
  html?: string;
  text?: string;
  brevoTemplateId?: number;
  brevoParams?: Record<string, string>;
}

/**
 * Single point of update for email templates. Maps template keys to Brevo template IDs and params,
 * or to code-backed subject/html/text. Add or change templates here only.
 * All templates are code-backed so the shared Bloggr email theme applies consistently.
 */
const BREVO_TEMPLATE_IDS: Partial<Record<EmailTemplateKey, number>> = {};

/** Variable names expected by Brevo for each template (must match Brevo dashboard). */
const BREVO_PARAM_NAMES: Partial<Record<EmailTemplateKey, string[]>> = {
  [EMAIL_TEMPLATE_KEYS.SITE_INVITATION]: ["inviterName", "siteName", "roleLabel", "acceptUrl", "expiresAt"],
  [EMAIL_TEMPLATE_KEYS.PASSWORD_RESET]: ["code", "expiresInMinutes", "firstName"],
  [EMAIL_TEMPLATE_KEYS.EMAIL_VERIFICATION]: ["code", "expiresInMinutes", "firstName"],
  [EMAIL_TEMPLATE_KEYS.COMMENT_ON_POST]: ["authorName", "blogTitle", "commentSnippet", "commentUrl"],
  [EMAIL_TEMPLATE_KEYS.WELCOME]: ["firstName", "loginUrl"],
  [EMAIL_TEMPLATE_KEYS.SCHEDULED_POST_REVIEW]: [
    "firstName",
    "siteName",
    "blogTitle",
    "scheduledFor",
    "reviewUrl",
    "excerpt",
  ],
  [EMAIL_TEMPLATE_KEYS.SCHEDULED_POST_REWORKED]: [
    "firstName",
    "siteName",
    "blogTitle",
    "scheduledFor",
    "reviewUrl",
    "reworkRound",
    "excerpt",
  ],
  [EMAIL_TEMPLATE_KEYS.WEEKLY_REVIEW_DIGEST]: [
    "firstName",
    "siteName",
    "weekOfLabel",
    "postCount",
    // postsHtml / postsText are pre-rendered lists (the registry does this for code-backed
    // sends; Brevo users will need an equivalent loop in their template).
    "postsHtml",
    "postsText",
  ],
};

export function getBrevoTemplateId(key: EmailTemplateKey): number | null {
  return BREVO_TEMPLATE_IDS[key] ?? null;
}

/**
 * Returns rendered email for a template key. Prefer Brevo template when id is set; otherwise
 * returns subject/html/text for code-backed send. Params are passed to Brevo or interpolated in code.
 */
export function getTemplate(
  key: EmailTemplateKey,
  locale: string = DEFAULT_EMAIL_LOCALE,
  params: Record<string, string> = {}
): RenderedEmail {
  const templateId = getBrevoTemplateId(key);
  const paramNames = BREVO_PARAM_NAMES[key];
  const brevoParams =
    paramNames && templateId != null
      ? Object.fromEntries(paramNames.map((name) => [name, params[name] ?? ""]))
      : undefined;

  if (templateId != null) {
    const subject = getSubjectForTemplate(key, params);
    return {
      subject,
      brevoTemplateId: templateId,
      brevoParams,
    };
  }

  return getCodeBackedTemplate(key, locale, params);
}

function getSubjectForTemplate(key: EmailTemplateKey, params: Record<string, string>): string {
  switch (key) {
    case EMAIL_TEMPLATE_KEYS.SITE_INVITATION:
      return `You've been invited to collaborate on ${params.siteName ?? "a site"}`;
    case EMAIL_TEMPLATE_KEYS.PASSWORD_RESET:
      return "Your password reset code";
    case EMAIL_TEMPLATE_KEYS.EMAIL_VERIFICATION:
      return "Verify your Bloggr email";
    case EMAIL_TEMPLATE_KEYS.COMMENT_ON_POST:
      return `New comment on "${params.blogTitle ?? "your post"}"`;
    case EMAIL_TEMPLATE_KEYS.WELCOME:
      return `Welcome to Bloggr, ${params.firstName ?? "there"}!`;
    case EMAIL_TEMPLATE_KEYS.WAITLIST_CONFIRMATION:
      return "You're on the Bloggr waitlist";
    case EMAIL_TEMPLATE_KEYS.SCHEDULED_POST_REVIEW:
      return `Review needed: "${params.blogTitle ?? "scheduled post"}"`;
    case EMAIL_TEMPLATE_KEYS.SCHEDULED_POST_REWORKED:
      return `Re-review: "${params.blogTitle ?? "scheduled post"}"`;
    case EMAIL_TEMPLATE_KEYS.WEEKLY_REVIEW_DIGEST: {
      const count = params.postCount ?? "0";
      const site = params.siteName ?? "your workspace";
      return `${count} post${count === "1" ? "" : "s"} need your review this week — ${site}`;
    }
    case EMAIL_TEMPLATE_KEYS.CAMPAIGN_DAILY_PROGRESS_REPORT:
      return `Campaign update: ${params.campaignName ?? "Campaign"} — ${params.reportDate ?? "today"}`;
    default:
      return "Notification";
  }
}

function getCodeBackedTemplate(key: EmailTemplateKey, _locale: string, params: Record<string, string>): RenderedEmail {
  switch (key) {
    case EMAIL_TEMPLATE_KEYS.SITE_INVITATION:
      return {
        subject: getSubjectForTemplate(key, params),
        html: buildSiteInvitationHtml(params),
        text: buildSiteInvitationText(params),
      };
    case EMAIL_TEMPLATE_KEYS.PASSWORD_RESET:
      return {
        subject: getSubjectForTemplate(key, params),
        html: buildPasswordResetHtml(params),
        text: buildPasswordResetText(params),
      };
    case EMAIL_TEMPLATE_KEYS.EMAIL_VERIFICATION:
      return {
        subject: getSubjectForTemplate(key, params),
        html: buildEmailVerificationHtml(params),
        text: buildEmailVerificationText(params),
      };
    case EMAIL_TEMPLATE_KEYS.COMMENT_ON_POST:
      return {
        subject: getSubjectForTemplate(key, params),
        html: buildCommentOnPostHtml(params),
        text: buildCommentOnPostText(params),
      };
    case EMAIL_TEMPLATE_KEYS.WELCOME:
      return {
        subject: getSubjectForTemplate(key, params),
        html: buildWelcomeHtml(params),
        text: buildWelcomeText(params),
      };
    case EMAIL_TEMPLATE_KEYS.WAITLIST_CONFIRMATION:
      return {
        subject: getSubjectForTemplate(key, params),
        html: buildWaitlistConfirmationHtml(params),
        text: buildWaitlistConfirmationText(params),
      };
    case EMAIL_TEMPLATE_KEYS.SCHEDULED_POST_REVIEW:
      return {
        subject: getSubjectForTemplate(key, params),
        html: buildScheduledPostReviewHtml(params),
        text: buildScheduledPostReviewText(params),
      };
    case EMAIL_TEMPLATE_KEYS.SCHEDULED_POST_REWORKED:
      return {
        subject: getSubjectForTemplate(key, params),
        html: buildScheduledPostReworkedHtml(params),
        text: buildScheduledPostReworkedText(params),
      };
    case EMAIL_TEMPLATE_KEYS.WEEKLY_REVIEW_DIGEST:
      return {
        subject: getSubjectForTemplate(key, params),
        html: buildWeeklyDigestHtml(params),
        text: buildWeeklyDigestText(params),
      };
    case EMAIL_TEMPLATE_KEYS.CAMPAIGN_DAILY_PROGRESS_REPORT:
      return {
        subject: getSubjectForTemplate(key, params),
        html: buildCampaignProgressHtml(params),
        text: buildCampaignProgressText(params),
      };
    default:
      return { subject: "Notification", text: "" };
  }
}

function postCard(blogTitle: string, scheduledFor: string, excerpt: string): string {
  const excerptHtml = excerpt
    ? `<p style="margin: 12px 0 0; color: ${EMAIL_COLORS.body}; font-size: 15px; line-height: 1.5;">${escapeHtml(excerpt)}</p>`
    : "";
  return contentCard(
    `<div style="font-size: 18px; font-weight: 600; color: ${EMAIL_COLORS.heading};">${escapeHtml(blogTitle)}</div>
    <div style="font-size: 13px; color: ${EMAIL_COLORS.muted}; margin-top: 4px;">Scheduled for ${escapeHtml(scheduledFor)}</div>
    ${excerptHtml}`
  );
}

function buildWelcomeHtml(params: Record<string, string>): string {
  const firstName = params.firstName ?? "there";
  const loginUrl = params.loginUrl ?? "#";
  const body = `
    ${heading("Welcome to Bloggr")}
    ${paragraph(`Hi ${escapeHtml(firstName)},`)}
    ${paragraph("Your account has been created. Sign in to start managing your blogs.")}
    <p style="margin: 24px 0;">${primaryButton(loginUrl, "Sign in")}</p>
    ${disclaimer("If you didn't create this account, you can ignore this email.")}
  `;
  return wrapEmail({ preheader: "Your Bloggr account is ready — sign in to get started.", bodyHtml: body });
}

function buildWelcomeText(params: Record<string, string>): string {
  const firstName = params.firstName ?? "there";
  const loginUrl = params.loginUrl ?? "#";
  return `Welcome to Bloggr, ${firstName}. Sign in: ${loginUrl}`;
}

function buildWaitlistConfirmationHtml(params: Record<string, string>): string {
  const firstName = params.firstName ?? "there";
  const siteUrl = params.siteUrl ?? "#";
  const body = `
    ${heading("You're on the list")}
    ${paragraph(`Hi ${escapeHtml(firstName)},`)}
    ${paragraph("Thanks for joining the Bloggr waitlist. We'll notify you when early access opens — we're targeting mid-July 2026.")}
    ${paragraph("Early access gets you founding-member pricing, a private beta invite, and a shot at lifetime access when you share Bloggr with your team.")}
    <p style="margin: 24px 0;">${primaryButton(siteUrl, "Visit Bloggr")}</p>
    ${disclaimer("If you didn't sign up for the waitlist, you can ignore this email.")}
  `;
  return wrapEmail({
    preheader: "You're on the Bloggr waitlist. Early access targets mid-July 2026.",
    bodyHtml: body,
  });
}

function buildWaitlistConfirmationText(params: Record<string, string>): string {
  const firstName = params.firstName ?? "there";
  const siteUrl = params.siteUrl ?? "#";
  return `Hi ${firstName}, you're on the Bloggr waitlist. We'll notify you when early access opens (targeting mid-July 2026). Visit: ${siteUrl}`;
}

function buildSiteInvitationHtml(params: Record<string, string>): string {
  const inviterName = params.inviterName ?? "A team member";
  const siteName = params.siteName ?? "a site";
  const roleLabel = params.roleLabel ?? "member";
  const acceptUrl = params.acceptUrl ?? "#";
  const expiresAt = params.expiresAt ?? "";
  const isNewUser = params.isNewUser === "true";
  const ctaLabel = isNewUser ? "Create account & join" : "Accept invitation";
  const intro = isNewUser
    ? paragraph("You don't have a Bloggr account yet. Create one with the same email address to join the workspace.")
    : "";
  const metaCard = contentCard(
    `<div style="font-size: 14px; color: ${EMAIL_COLORS.body}; line-height: 1.6;">
      <div><strong style="color: ${EMAIL_COLORS.heading};">Invited by</strong> ${escapeHtml(inviterName)}</div>
      <div style="margin-top: 6px;"><strong style="color: ${EMAIL_COLORS.heading};">Role</strong> ${escapeHtml(roleLabel)}</div>
      ${expiresAt ? `<div style="margin-top: 6px;"><strong style="color: ${EMAIL_COLORS.heading};">Expires</strong> ${escapeHtml(expiresAt)}</div>` : ""}
    </div>`
  );
  const body = `
    ${heading(`You're invited to ${siteName}`)}
    ${paragraph(`<strong>${escapeHtml(inviterName)}</strong> has invited you to collaborate on <strong>${escapeHtml(siteName)}</strong> as a <strong>${escapeHtml(roleLabel)}</strong>.`)}
    ${intro}
    ${metaCard}
    <p style="margin: 24px 0;">${primaryButton(acceptUrl, ctaLabel)}</p>
    ${disclaimer("If you didn't expect this invitation, you can ignore this email.")}
  `;
  return wrapEmail({
    preheader: `${inviterName} invited you to collaborate on ${siteName}.`,
    bodyHtml: body,
  });
}

function buildSiteInvitationText(params: Record<string, string>): string {
  const inviterName = params.inviterName ?? "A team member";
  const siteName = params.siteName ?? "a site";
  const roleLabel = params.roleLabel ?? "member";
  const acceptUrl = params.acceptUrl ?? "#";
  const isNewUser = params.isNewUser === "true";
  const prefix = isNewUser ? "Create an account to join: " : "Accept: ";
  return `${inviterName} invited you to ${siteName} as ${roleLabel}. ${prefix}${acceptUrl}`;
}

function buildPasswordResetHtml(params: Record<string, string>): string {
  const code = params.code ?? "";
  const expiresInMinutes = params.expiresInMinutes ?? "15";
  const firstName = params.firstName ?? "there";
  const body = `
    ${heading("Reset your password")}
    ${paragraph(`Hi ${escapeHtml(firstName)},`)}
    ${paragraph(`Use the code below to complete your password reset. It expires in ${escapeHtml(expiresInMinutes)} minutes.`)}
    ${codeBlock(code)}
    ${disclaimer("If you didn't request this, you can safely ignore this email; your password will not change.")}
  `;
  return wrapEmail({
    preheader: `Your Bloggr password reset code expires in ${expiresInMinutes} minutes.`,
    bodyHtml: body,
  });
}

function buildPasswordResetText(params: Record<string, string>): string {
  const code = params.code ?? "";
  const expiresInMinutes = params.expiresInMinutes ?? "15";
  return `Your Bloggr password reset code is ${code}. It expires in ${expiresInMinutes} minutes. If you didn't request this, ignore this email.`;
}

function buildEmailVerificationHtml(params: Record<string, string>): string {
  const code = params.code ?? "";
  const expiresInMinutes = params.expiresInMinutes ?? "15";
  const firstName = params.firstName ?? "there";
  const body = `
    ${heading("Verify your email")}
    ${paragraph(`Hi ${escapeHtml(firstName)},`)}
    ${paragraph(`Welcome to Bloggr. Use the code below to verify your email address. It expires in ${escapeHtml(expiresInMinutes)} minutes.`)}
    ${codeBlock(code)}
    ${disclaimer("If you didn't create a Bloggr account, you can safely ignore this email.")}
  `;
  return wrapEmail({
    preheader: `Your Bloggr verification code expires in ${expiresInMinutes} minutes.`,
    bodyHtml: body,
  });
}

function buildEmailVerificationText(params: Record<string, string>): string {
  const code = params.code ?? "";
  const expiresInMinutes = params.expiresInMinutes ?? "15";
  return `Your Bloggr email verification code is ${code}. It expires in ${expiresInMinutes} minutes. If you didn't create an account, ignore this email.`;
}

function buildCommentOnPostHtml(params: Record<string, string>): string {
  const authorName = params.authorName ?? "Someone";
  const blogTitle = params.blogTitle ?? "your post";
  const commentSnippet = params.commentSnippet ?? "";
  const commentUrl = params.commentUrl ?? "#";
  const snippetCard = commentSnippet
    ? contentCard(
        `<p style="margin: 0; color: ${EMAIL_COLORS.body}; font-size: 15px; line-height: 1.5;">${escapeHtml(commentSnippet)}</p>`
      )
    : "";
  const body = `
    ${heading("New comment")}
    ${paragraph(`<strong>${escapeHtml(authorName)}</strong> commented on "${escapeHtml(blogTitle)}".`)}
    ${snippetCard}
    <p style="margin: 24px 0;">${primaryButton(commentUrl, "View comment")}</p>
  `;
  return wrapEmail({
    preheader: `${authorName} commented on "${blogTitle}".`,
    bodyHtml: body,
  });
}

function buildCommentOnPostText(params: Record<string, string>): string {
  const authorName = params.authorName ?? "Someone";
  const blogTitle = params.blogTitle ?? "your post";
  const commentUrl = params.commentUrl ?? "#";
  return `${authorName} commented on "${blogTitle}". View: ${commentUrl}`;
}

function buildScheduledPostReviewHtml(params: Record<string, string>): string {
  const firstName = params.firstName ?? "there";
  const siteName = params.siteName ?? "your workspace";
  const blogTitle = params.blogTitle ?? "a scheduled post";
  const scheduledFor = params.scheduledFor ?? "soon";
  const reviewUrl = params.reviewUrl ?? "#";
  const excerpt = params.excerpt ?? "";
  const body = `
    ${heading("Pre-publish review needed")}
    ${paragraph(`Hi ${escapeHtml(firstName)}, a post is scheduled to go live on <strong>${escapeHtml(siteName)}</strong> and is waiting for your sign-off.`)}
    ${postCard(blogTitle, scheduledFor, excerpt)}
    <p style="margin: 24px 0;">${primaryButton(reviewUrl, "Review the draft")}</p>
    ${muted("From the review page you can approve the draft as-is or request changes with a note for the editor. The post will not publish until you approve it.")}
  `;
  return wrapEmail({
    preheader: `"${blogTitle}" is waiting for your sign-off before publish.`,
    bodyHtml: body,
  });
}

function buildScheduledPostReviewText(params: Record<string, string>): string {
  const firstName = params.firstName ?? "there";
  const siteName = params.siteName ?? "your workspace";
  const blogTitle = params.blogTitle ?? "a scheduled post";
  const scheduledFor = params.scheduledFor ?? "soon";
  const reviewUrl = params.reviewUrl ?? "#";
  return `Hi ${firstName},

A post on ${siteName} is scheduled to publish on ${scheduledFor} and is waiting for your sign-off:

  "${blogTitle}"

Review and approve (or request changes): ${reviewUrl}

It will not publish until you approve it.`;
}

function buildScheduledPostReworkedHtml(params: Record<string, string>): string {
  const firstName = params.firstName ?? "there";
  const siteName = params.siteName ?? "your workspace";
  const blogTitle = params.blogTitle ?? "a scheduled post";
  const scheduledFor = params.scheduledFor ?? "soon";
  const reviewUrl = params.reviewUrl ?? "#";
  const excerpt = params.excerpt ?? "";
  const reworkRound = params.reworkRound ?? "1";
  const body = `
    ${heading("Ready for re-review")}
    ${paragraph(`Hi ${escapeHtml(firstName)}, we applied your feedback to <strong>${escapeHtml(siteName)}</strong>'s scheduled post.`)}
    ${contentCard(
      `<div style="font-size: 13px; color: ${EMAIL_COLORS.muted}; margin-bottom: 8px;">Rework round ${escapeHtml(reworkRound)}</div>
      <div style="font-size: 18px; font-weight: 600; color: ${EMAIL_COLORS.heading};">${escapeHtml(blogTitle)}</div>
      <div style="font-size: 13px; color: ${EMAIL_COLORS.muted}; margin-top: 4px;">Scheduled for ${escapeHtml(scheduledFor)}</div>
      ${excerpt ? `<p style="margin: 12px 0 0; color: ${EMAIL_COLORS.body}; font-size: 15px; line-height: 1.5;">${escapeHtml(excerpt)}</p>` : ""}`
    )}
    <p style="margin: 24px 0;">${primaryButton(reviewUrl, "Review the updated draft")}</p>
    ${muted("You can approve the revised draft or send back another round of changes.")}
  `;
  return wrapEmail({
    preheader: `Rework round ${reworkRound} for "${blogTitle}" is ready to review.`,
    bodyHtml: body,
  });
}

function buildScheduledPostReworkedText(params: Record<string, string>): string {
  const firstName = params.firstName ?? "there";
  const siteName = params.siteName ?? "your workspace";
  const blogTitle = params.blogTitle ?? "a scheduled post";
  const scheduledFor = params.scheduledFor ?? "soon";
  const reviewUrl = params.reviewUrl ?? "#";
  const reworkRound = params.reworkRound ?? "1";
  return `Hi ${firstName},

We applied your feedback (rework round ${reworkRound}) to "${blogTitle}" on ${siteName} (scheduled ${scheduledFor}).

Re-review: ${reviewUrl}`;
}

function buildWeeklyDigestHtml(params: Record<string, string>): string {
  const firstName = params.firstName ?? "there";
  const siteName = params.siteName ?? "your workspace";
  const weekOfLabel = params.weekOfLabel ?? "this week";
  const postCount = params.postCount ?? "0";
  const postsHtml = params.postsHtml ?? "";
  const countLabel = `${postCount} post${postCount === "1" ? "" : "s"} to review`;
  const listOrEmpty =
    postsHtml ||
    `<p style="color: ${EMAIL_COLORS.muted}; font-size: 16px; line-height: 1.6; margin: 16px 0;">Nothing pending — you're all caught up.</p>`;
  const body = `
    ${heading(countLabel)}
    ${paragraph(`Hi ${escapeHtml(firstName)}, here's what's scheduled on <strong>${escapeHtml(siteName)}</strong> for ${escapeHtml(weekOfLabel)} and still waiting for your sign-off.`)}
    ${listOrEmpty}
    ${muted("Posts will not publish until you approve them from the review page.")}
  `;
  return wrapEmail({
    preheader: `${postCount} post${postCount === "1" ? "" : "s"} on ${siteName} need your review.`,
    bodyHtml: body,
  });
}

function buildWeeklyDigestText(params: Record<string, string>): string {
  const firstName = params.firstName ?? "there";
  const siteName = params.siteName ?? "your workspace";
  const weekOfLabel = params.weekOfLabel ?? "this week";
  const postCount = params.postCount ?? "0";
  const postsText = params.postsText ?? "";
  return `Hi ${firstName},

You have ${postCount} post(s) scheduled on ${siteName} for ${weekOfLabel} that still need approval:

${postsText}

Posts will not publish until you approve them.`;
}

function healthColor(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized === "healthy" || normalized === "on_track" || normalized === "good") {
    return EMAIL_COLORS.success;
  }
  if (normalized === "at_risk" || normalized === "warning" || normalized === "attention") {
    return EMAIL_COLORS.warning;
  }
  return EMAIL_COLORS.muted;
}

function buildCampaignProgressHtml(params: Record<string, string>): string {
  const campaignName = params.campaignName ?? "Campaign";
  const narrative = params.narrativeSummary ?? "";
  const highlights = params.highlights ?? "";
  const risks = params.risks ?? "";
  const ctaUrl = params.ctaUrl ?? "#";
  const pct = params.percentComplete ?? "0";
  const healthStatus = params.healthStatus ?? "unknown";
  const health = healthColor(healthStatus);

  const statsCard = contentCard(
    `<div style="font-size: 16px; color: ${EMAIL_COLORS.body}; line-height: 1.6;">
      <div><strong style="color: ${EMAIL_COLORS.heading}; font-size: 22px;">${escapeHtml(pct)}%</strong> complete</div>
      <div style="margin-top: 8px;">Health: <strong style="color: ${health};">${escapeHtml(healthStatus)}</strong></div>
    </div>`
  );

  const highlightsCard = highlights
    ? contentCard(
        `<div style="font-size: 13px; font-weight: 600; color: ${EMAIL_COLORS.heading}; margin-bottom: 6px;">Highlights</div>
        <p style="margin: 0; color: ${EMAIL_COLORS.body}; font-size: 15px; line-height: 1.5;">${escapeHtml(highlights)}</p>`
      )
    : "";

  const risksBlock = risks
    ? `<div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <div style="font-size: 13px; font-weight: 600; color: ${EMAIL_COLORS.warning}; margin-bottom: 6px;">Attention</div>
        <p style="margin: 0; color: ${EMAIL_COLORS.warning}; font-size: 15px; line-height: 1.5;">${escapeHtml(risks)}</p>
      </div>`
    : "";

  const pending =
    params.pendingCount && params.pendingCount !== "0"
      ? paragraph(`${escapeHtml(params.pendingCount)} post(s) awaiting your approval before publish.`)
      : "";

  const body = `
    ${heading(`${campaignName} — daily progress`)}
    ${statsCard}
    ${narrative ? paragraph(escapeHtml(narrative)) : ""}
    ${highlightsCard}
    ${risksBlock}
    ${pending}
    <p style="margin: 24px 0;">${primaryButton(ctaUrl, "View full report")}</p>
  `;
  return wrapEmail({
    preheader: `${campaignName}: ${pct}% complete · ${healthStatus}`,
    bodyHtml: body,
  });
}

function buildCampaignProgressText(params: Record<string, string>): string {
  return `${params.campaignName ?? "Campaign"} — ${params.reportDate ?? ""}

${params.narrativeSummary ?? ""}

Progress: ${params.percentComplete ?? "0"}%
Highlights: ${params.highlights ?? "—"}
Risks: ${params.risks ?? "—"}
Pending approvals: ${params.pendingCount ?? "0"}

View report: ${params.ctaUrl ?? ""}`;
}
