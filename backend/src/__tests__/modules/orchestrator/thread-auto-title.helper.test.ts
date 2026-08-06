import { describe, expect, it } from "@jest/globals";
import {
  buildAutoTitlePromptContext,
  sanitizeGeneratedTitle,
  shouldAutoTitleThread,
  countUserMessages,
} from "../../../modules/orchestrator/utils/thread-auto-title.helper";
import { OrchestratorMessageRole } from "../../../shared/schemas/orchestrator-message.schema";
import type { OrchestratorMessage } from "../../../shared/schemas/orchestrator-message.schema";
import type { OrchestratorThread } from "../../../shared/schemas/orchestrator-thread.schema";
import { EMAIL_TEMPLATE_KEYS } from "../../../shared/constants/notification.constant";
import { getTemplate } from "../../../shared/services/email-template.registry";

function msg(role: OrchestratorMessageRole, content: string): OrchestratorMessage {
  return { role, content } as OrchestratorMessage;
}

describe("thread auto-title eligibility", () => {
  it("requires at least 2 user messages and default title source", () => {
    const thread = {
      is_onboarding: false,
      title: "New conversation",
      title_source: "default",
    } as OrchestratorThread;
    const one = [msg(OrchestratorMessageRole.USER, "Hello there")];
    expect(shouldAutoTitleThread(thread, one)).toBe(false);

    const two = [
      msg(OrchestratorMessageRole.USER, "Hello"),
      msg(OrchestratorMessageRole.ASSISTANT, "Hi"),
      msg(OrchestratorMessageRole.USER, "Write about SEO"),
    ];
    expect(countUserMessages(two)).toBe(2);
    expect(shouldAutoTitleThread(thread, two)).toBe(true);
  });

  it("skips onboarding and user/auto titled threads", () => {
    const two = [msg(OrchestratorMessageRole.USER, "a"), msg(OrchestratorMessageRole.USER, "b")];
    expect(
      shouldAutoTitleThread(
        { is_onboarding: true, title: "Workspace onboarding", title_source: "default" } as OrchestratorThread,
        two
      )
    ).toBe(false);
    expect(
      shouldAutoTitleThread({ is_onboarding: false, title: "My chat", title_source: "user" } as OrchestratorThread, two)
    ).toBe(false);
    expect(
      shouldAutoTitleThread(
        { is_onboarding: false, title: "SEO tips", title_source: "auto" } as OrchestratorThread,
        two
      )
    ).toBe(false);
  });

  it("sanitizes generated titles", () => {
    expect(sanitizeGeneratedTitle('"SEO Content Plan"')).toBe("SEO Content Plan");
    expect(sanitizeGeneratedTitle("Hi")).toBeNull();
    expect(sanitizeGeneratedTitle("New conversation")).toBeNull();
  });

  it("builds prompt context from recent messages", () => {
    const ctx = buildAutoTitlePromptContext([
      msg(OrchestratorMessageRole.USER, "Help me with LinkedIn posts"),
      msg(OrchestratorMessageRole.ASSISTANT, "Sure — what audience?"),
    ]);
    expect(ctx).toContain("User: Help me with LinkedIn posts");
    expect(ctx).toContain("Assistant:");
  });
});

describe("email verification template", () => {
  it("uses distinct subject and body from password reset", () => {
    const verify = getTemplate(EMAIL_TEMPLATE_KEYS.EMAIL_VERIFICATION, "en", {
      code: "123456",
      expiresInMinutes: "15",
      firstName: "Alex",
    });
    const reset = getTemplate(EMAIL_TEMPLATE_KEYS.PASSWORD_RESET, "en", {
      code: "123456",
      expiresInMinutes: "15",
      firstName: "Alex",
    });
    expect(EMAIL_TEMPLATE_KEYS.EMAIL_VERIFICATION).toBe("email_verification");
    expect(verify.subject).toContain("Verify");
    expect(verify.subject).not.toContain("password");
    expect(verify.html).toContain("Verify your email");
    expect(verify.html).not.toContain("reset your Bloggr password");
    expect(reset.subject).toContain("password reset");
    expect(reset.html).toContain("password reset");
  });
});
