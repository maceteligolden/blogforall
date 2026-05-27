import { EMAIL_TEMPLATE_KEYS, DEFAULT_EMAIL_LOCALE, type EmailTemplateKey } from "../constants/notification.constant";

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
 */
const BREVO_TEMPLATE_IDS: Partial<Record<EmailTemplateKey, number>> = {
  [EMAIL_TEMPLATE_KEYS.SITE_INVITATION]: 1,
  [EMAIL_TEMPLATE_KEYS.COMMENT_ON_POST]: 3,
};

/** Variable names expected by Brevo for each template (must match Brevo dashboard). */
const BREVO_PARAM_NAMES: Partial<Record<EmailTemplateKey, string[]>> = {
  [EMAIL_TEMPLATE_KEYS.SITE_INVITATION]: ["inviterName", "siteName", "roleLabel", "acceptUrl", "expiresAt"],
  [EMAIL_TEMPLATE_KEYS.PASSWORD_RESET]: ["code", "expiresInMinutes", "firstName"],
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
    case EMAIL_TEMPLATE_KEYS.COMMENT_ON_POST:
      return `New comment on "${params.blogTitle ?? "your post"}"`;
    case EMAIL_TEMPLATE_KEYS.WELCOME:
      return `Welcome to Bloggr, ${params.firstName ?? "there"}!`;
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

function buildWelcomeHtml(params: Record<string, string>): string {
  const firstName = params.firstName ?? "there";
  const loginUrl = params.loginUrl ?? "#";
  return `
<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1>Welcome to Bloggr!</h1>
  <p>Hi ${escapeHtml(firstName)},</p>
  <p>Your account has been created. You can sign in and start managing your blogs.</p>
  <p><a href="${escapeHtml(loginUrl)}" style="background: #3b82f6; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Sign in</a></p>
  <p style="color: #999; font-size: 12px;">If you didn't create this account, you can ignore this email.</p>
</body>
</html>`;
}

function buildWelcomeText(params: Record<string, string>): string {
  const firstName = params.firstName ?? "there";
  const loginUrl = params.loginUrl ?? "#";
  return `Welcome to Bloggr, ${firstName}. Sign in: ${loginUrl}`;
}

function buildSiteInvitationHtml(params: Record<string, string>): string {
  const inviterName = params.inviterName ?? "A team member";
  const siteName = params.siteName ?? "a site";
  const roleLabel = params.roleLabel ?? "member";
  const acceptUrl = params.acceptUrl ?? "#";
  const expiresAt = params.expiresAt ?? "";
  return `
<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1>You've been invited!</h1>
  <p><strong>${escapeHtml(inviterName)}</strong> has invited you to collaborate on <strong>${escapeHtml(siteName)}</strong> as a <strong>${escapeHtml(roleLabel)}</strong>.</p>
  <p>Expires: ${escapeHtml(expiresAt)}</p>
  <p><a href="${escapeHtml(acceptUrl)}" style="background: #3b82f6; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Accept invitation</a></p>
  <p style="color: #999; font-size: 12px;">If you didn't expect this, you can ignore this email.</p>
</body>
</html>`;
}

function buildSiteInvitationText(params: Record<string, string>): string {
  const inviterName = params.inviterName ?? "A team member";
  const siteName = params.siteName ?? "a site";
  const roleLabel = params.roleLabel ?? "member";
  const acceptUrl = params.acceptUrl ?? "#";
  return `${inviterName} invited you to ${siteName} as ${roleLabel}. Accept: ${acceptUrl}`;
}

function buildPasswordResetHtml(params: Record<string, string>): string {
  const code = params.code ?? "";
  const expiresInMinutes = params.expiresInMinutes ?? "15";
  const firstName = params.firstName ?? "there";
  return `
<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1>Your password reset code</h1>
  <p>Hi ${escapeHtml(firstName)},</p>
  <p>Use the code below to reset your Bloggr password. It expires in ${escapeHtml(expiresInMinutes)} minutes.</p>
  <p style="font-size: 32px; letter-spacing: 8px; font-weight: 700; background: #f3f4f6; padding: 16px 24px; border-radius: 8px; text-align: center; font-family: 'SFMono-Regular', Menlo, Consolas, monospace;">${escapeHtml(code)}</p>
  <p style="color: #999; font-size: 12px;">If you didn't request this, you can safely ignore this email; your password will not change.</p>
</body>
</html>`;
}

function buildPasswordResetText(params: Record<string, string>): string {
  const code = params.code ?? "";
  const expiresInMinutes = params.expiresInMinutes ?? "15";
  return `Your Bloggr password reset code is ${code}. It expires in ${expiresInMinutes} minutes. If you didn't request this, ignore this email.`;
}

function buildCommentOnPostHtml(params: Record<string, string>): string {
  const authorName = params.authorName ?? "Someone";
  const blogTitle = params.blogTitle ?? "your post";
  const commentSnippet = params.commentSnippet ?? "";
  const commentUrl = params.commentUrl ?? "#";
  return `
<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1>New comment</h1>
  <p><strong>${escapeHtml(authorName)}</strong> commented on "${escapeHtml(blogTitle)}".</p>
  <p>${escapeHtml(commentSnippet)}</p>
  <p><a href="${escapeHtml(commentUrl)}">View comment</a></p>
</body>
</html>`;
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
  return `
<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="margin-bottom: 8px;">Pre-publish review needed</h1>
  <p style="color: #555; margin-top: 0;">Hi ${escapeHtml(firstName)}, a post is scheduled to go live on <strong>${escapeHtml(siteName)}</strong> and is waiting for your sign-off.</p>
  <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 16px 0;">
    <div style="font-size: 18px; font-weight: 600; color: #111827;">${escapeHtml(blogTitle)}</div>
    <div style="font-size: 13px; color: #6b7280; margin-top: 4px;">Scheduled for ${escapeHtml(scheduledFor)}</div>
    ${excerpt ? `<p style="margin: 12px 0 0; color: #374151;">${escapeHtml(excerpt)}</p>` : ""}
  </div>
  <p>
    <a href="${escapeHtml(reviewUrl)}" style="background: #3b82f6; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">Review the draft</a>
  </p>
  <p style="color: #6b7280; font-size: 13px;">From the review page you can approve the draft as-is or request changes with a note for the editor. The post will not publish until you approve it.</p>
</body>
</html>`;
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
  return `
<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="margin-bottom: 8px;">Rework ready for re-review</h1>
  <p style="color: #555; margin-top: 0;">Hi ${escapeHtml(firstName)}, we applied your feedback to <strong>${escapeHtml(siteName)}</strong>'s scheduled post (rework round ${escapeHtml(reworkRound)}).</p>
  <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 16px 0;">
    <div style="font-size: 18px; font-weight: 600; color: #111827;">${escapeHtml(blogTitle)}</div>
    <div style="font-size: 13px; color: #6b7280; margin-top: 4px;">Scheduled for ${escapeHtml(scheduledFor)}</div>
    ${excerpt ? `<p style="margin: 12px 0 0; color: #374151;">${escapeHtml(excerpt)}</p>` : ""}
  </div>
  <p>
    <a href="${escapeHtml(reviewUrl)}" style="background: #3b82f6; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">Review the updated draft</a>
  </p>
  <p style="color: #6b7280; font-size: 13px;">You can approve the revised draft or send back another round of changes.</p>
</body>
</html>`;
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
  return `
<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="margin-bottom: 8px;">${escapeHtml(postCount)} post${postCount === "1" ? "" : "s"} to review</h1>
  <p style="color: #555; margin-top: 0;">Hi ${escapeHtml(firstName)}, here's what's scheduled on <strong>${escapeHtml(siteName)}</strong> for ${escapeHtml(weekOfLabel)} and still waiting for your sign-off.</p>
  ${postsHtml || `<p style="color: #6b7280;">Nothing pending right now — you're all caught up.</p>`}
  <p style="color: #6b7280; font-size: 13px; margin-top: 24px;">Posts will not publish until you approve them from the review page.</p>
</body>
</html>`;
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

function buildCampaignProgressHtml(params: Record<string, string>): string {
  const campaignName = params.campaignName ?? "Campaign";
  const narrative = params.narrativeSummary ?? "";
  const highlights = params.highlights ?? "";
  const risks = params.risks ?? "";
  const ctaUrl = params.ctaUrl ?? "#";
  const pct = params.percentComplete ?? "0";
  return `
<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1>${escapeHtml(campaignName)} — daily progress</h1>
  <p><strong>${escapeHtml(pct)}%</strong> complete. Health: ${escapeHtml(params.healthStatus ?? "unknown")}.</p>
  <p>${escapeHtml(narrative)}</p>
  ${highlights ? `<p><strong>Highlights:</strong> ${escapeHtml(highlights)}</p>` : ""}
  ${risks ? `<p style="color:#b45309;"><strong>Attention:</strong> ${escapeHtml(risks)}</p>` : ""}
  ${params.pendingCount && params.pendingCount !== "0" ? `<p>${escapeHtml(params.pendingCount)} post(s) awaiting your approval before publish.</p>` : ""}
  <p><a href="${escapeHtml(ctaUrl)}" style="color:#2563eb;">View full report</a></p>
</body>
</html>`;
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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
