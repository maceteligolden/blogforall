/**
 * Shared Bloggr transactional email theme: colors, shell, and UI helpers.
 * Keep styles email-client safe (tables + inline CSS; media query in <head> only).
 */

export const EMAIL_COLORS = {
  canvas: "#f3f4f6",
  card: "#ffffff",
  brand: "#1e40af",
  cta: "#3b82f6",
  accent: "#22d3ee",
  heading: "#111827",
  body: "#374151",
  muted: "#6b7280",
  border: "#e5e7eb",
  surface: "#f9fafb",
  warning: "#b45309",
  success: "#059669",
  disclaimer: "#9ca3af",
  white: "#ffffff",
} as const;

export const EMAIL_FONT_STACK = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export const EMAIL_MONO_STACK = "'SFMono-Regular', Menlo, Consolas, monospace";

export const EMAIL_TAGLINE = "Context-aware blog posts from conversation, not prompts.";

export const EMAIL_SITE_URL = "https://bloggr.io";

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function primaryButton(href: string, label: string): string {
  return `<a href="${escapeHtml(href)}" class="email-cta" style="display: inline-block; background: ${EMAIL_COLORS.cta}; color: ${EMAIL_COLORS.white}; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; line-height: 1.25;">${escapeHtml(label)}</a>`;
}

export function contentCard(innerHtml: string): string {
  return `<div style="background: ${EMAIL_COLORS.surface}; border: 1px solid ${EMAIL_COLORS.border}; border-radius: 8px; padding: 16px; margin: 16px 0;">${innerHtml}</div>`;
}

export function codeBlock(code: string): string {
  return `<p class="email-otp" style="font-size: 32px; letter-spacing: 8px; font-weight: 700; background: ${EMAIL_COLORS.surface}; border: 1px solid ${EMAIL_COLORS.border}; padding: 16px 24px; border-radius: 8px; text-align: center; font-family: ${EMAIL_MONO_STACK}; color: ${EMAIL_COLORS.heading}; margin: 20px 0;">${escapeHtml(code)}</p>`;
}

export function muted(text: string): string {
  return `<p style="color: ${EMAIL_COLORS.muted}; font-size: 13px; line-height: 1.5; margin: 16px 0 0;">${escapeHtml(text)}</p>`;
}

export function disclaimer(text: string): string {
  return `<p style="color: ${EMAIL_COLORS.disclaimer}; font-size: 12px; line-height: 1.5; margin: 20px 0 0;">${escapeHtml(text)}</p>`;
}

export function heading(text: string): string {
  return `<h1 class="email-h1" style="margin: 0 0 12px; font-size: 24px; font-weight: 700; line-height: 1.3; color: ${EMAIL_COLORS.heading};">${escapeHtml(text)}</h1>`;
}

export function paragraph(html: string): string {
  return `<p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: ${EMAIL_COLORS.body};">${html}</p>`;
}

export interface WrapEmailOptions {
  preheader?: string;
  bodyHtml: string;
}

/**
 * Full HTML document with Bloggr header, accent bar, body slot, and footer.
 */
export function wrapEmail({ preheader = "", bodyHtml }: WrapEmailOptions): string {
  const preheaderHtml = preheader
    ? `<div style="display: none; max-height: 0; overflow: hidden; mso-hide: all;">${escapeHtml(preheader)}</div>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Bloggr</title>
  <style type="text/css">
    @media only screen and (max-width: 480px) {
      .email-h1 { font-size: 20px !important; }
      .email-body-pad { padding: 16px !important; }
      .email-otp { letter-spacing: 4px !important; font-size: 28px !important; }
      .email-cta { display: block !important; text-align: center !important; width: 100% !important; box-sizing: border-box !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background: ${EMAIL_COLORS.canvas}; font-family: ${EMAIL_FONT_STACK};">
  ${preheaderHtml}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background: ${EMAIL_COLORS.canvas};">
    <tr>
      <td align="center" style="padding: 24px 12px;">
        <table role="presentation" class="email-card" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; width: 100%; background: ${EMAIL_COLORS.card}; border-radius: 8px; overflow: hidden;">
          <tr>
            <td style="height: 3px; background: ${EMAIL_COLORS.accent}; font-size: 0; line-height: 0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding: 20px 24px 16px; border-bottom: 1px solid ${EMAIL_COLORS.border};">
              <div style="font-size: 22px; font-weight: 700; letter-spacing: 0.06em; color: ${EMAIL_COLORS.brand}; font-family: ${EMAIL_FONT_STACK};">Bloggr</div>
            </td>
          </tr>
          <tr>
            <td class="email-body-pad" style="padding: 24px;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding: 16px 24px; background: ${EMAIL_COLORS.surface}; border-top: 1px solid ${EMAIL_COLORS.border};">
              <p style="margin: 0 0 6px; font-size: 12px; line-height: 1.5; color: ${EMAIL_COLORS.muted};">${escapeHtml(EMAIL_TAGLINE)}</p>
              <p style="margin: 0; font-size: 12px; line-height: 1.5;">
                <a href="${EMAIL_SITE_URL}" style="color: ${EMAIL_COLORS.brand}; text-decoration: none;">bloggr.io</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
