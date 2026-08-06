import { describe, expect, it } from "@jest/globals";
import { EMAIL_TEMPLATE_KEYS } from "../../../shared/constants/notification.constant";
import { getBrevoTemplateId, getTemplate } from "../../../shared/services/email-template.registry";
import { EMAIL_COLORS, EMAIL_TAGLINE, wrapEmail } from "../../../shared/services/email-theme";

describe("email theme shell", () => {
  it("wraps body with Bloggr wordmark, accent, max-width card, and tagline footer", () => {
    const html = wrapEmail({ preheader: "Preview line", bodyHtml: "<p>Hello</p>" });
    expect(html).toContain("Bloggr");
    expect(html).toContain(EMAIL_COLORS.brand);
    expect(html).toContain(EMAIL_COLORS.accent);
    expect(html).toContain("max-width: 600px");
    expect(html).toContain(EMAIL_TAGLINE);
    expect(html).toContain("Preview line");
    expect(html).toContain("@media only screen and (max-width: 480px)");
    expect(html).toContain(".email-cta");
  });
});

describe("email template theme", () => {
  it("renders welcome with shared shell and primary CTA color", () => {
    const welcome = getTemplate(EMAIL_TEMPLATE_KEYS.WELCOME, "en", {
      firstName: "Alex",
      loginUrl: "https://app.bloggr.io/login",
    });
    expect(welcome.brevoTemplateId).toBeUndefined();
    expect(welcome.html).toContain("Welcome to Bloggr");
    expect(welcome.html).toContain("Bloggr");
    expect(welcome.html).toContain("max-width: 600px");
    expect(welcome.html).toContain(EMAIL_COLORS.cta);
    expect(welcome.html).toContain("Sign in");
    expect(welcome.html).toContain("https://app.bloggr.io/login");
    expect(welcome.text).toContain("https://app.bloggr.io/login");
  });

  it("renders email verification OTP with shell and no password-reset copy", () => {
    const verify = getTemplate(EMAIL_TEMPLATE_KEYS.EMAIL_VERIFICATION, "en", {
      code: "123456",
      expiresInMinutes: "15",
      firstName: "Alex",
    });
    expect(verify.html).toContain("Verify your email");
    expect(verify.html).toContain("123456");
    expect(verify.html).toContain("email-otp");
    expect(verify.html).toContain("max-width: 600px");
    expect(verify.html).not.toContain("password reset");
  });

  it("renders weekly digest with shell and empty-state copy", () => {
    const digest = getTemplate(EMAIL_TEMPLATE_KEYS.WEEKLY_REVIEW_DIGEST, "en", {
      firstName: "Alex",
      siteName: "Acme",
      weekOfLabel: "this week",
      postCount: "0",
      postsHtml: "",
    });
    expect(digest.html).toContain("0 posts to review");
    expect(digest.html).toContain("Nothing pending");
    expect(digest.html).toContain("max-width: 600px");
    expect(digest.html).toContain(EMAIL_COLORS.accent);
  });

  it("sends comment_on_post as code-backed HTML without Brevo template id", () => {
    expect(getBrevoTemplateId(EMAIL_TEMPLATE_KEYS.COMMENT_ON_POST)).toBeNull();
    const comment = getTemplate(EMAIL_TEMPLATE_KEYS.COMMENT_ON_POST, "en", {
      authorName: "Sam",
      blogTitle: "Launch post",
      commentSnippet: "Looks great!",
      commentUrl: "https://app.bloggr.io/comments/1",
    });
    expect(comment.brevoTemplateId).toBeUndefined();
    expect(comment.html).toBeDefined();
    expect(comment.html).toContain("New comment");
    expect(comment.html).toContain("Looks great!");
    expect(comment.html).toContain(EMAIL_COLORS.cta);
    expect(comment.html).toContain("View comment");
    expect(comment.text).toContain("https://app.bloggr.io/comments/1");
  });
});
