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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
