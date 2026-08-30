import type { Metadata } from "next";
import Link from "next/link";
import { LegalPageShell } from "@/components/legal/legal-page-shell";
import { LEGAL_LAST_UPDATED } from "@/lib/legal/terms-version";

export const metadata: Metadata = {
  title: "Privacy Policy — Bloggr",
  description: "How Bloggr collects, uses, and protects your personal information.",
};

export default function PrivacyPage() {
  return (
    <LegalPageShell title="Bloggr Privacy Policy" lastUpdated={LEGAL_LAST_UPDATED}>
      <p>
        This Privacy Policy explains how Bloggr Ltd, a company registered in the United Kingdom (&quot;Bloggr&quot;,
        &quot;we&quot;, &quot;us&quot;), collects, uses, and shares personal information when you use Bloggr. It should
        be read alongside our <Link href="/terms">Terms and Conditions</Link> and{" "}
        <Link href="/cookies">Cookie Policy</Link>.
      </p>
      <p>
        If you have questions, email <a href="mailto:support@bloggr.io">support@bloggr.io</a>.
      </p>

      <h2>1. Who we are</h2>
      <p>
        Bloggr Ltd is the controller of personal data processed in connection with your Bloggr account and use of the
        service. We operate Bloggr from the United Kingdom.
      </p>

      <h2>2. Information we collect</h2>
      <p>We collect the following categories of information:</p>
      <ul>
        <li>
          <strong className="text-white">Account details:</strong> name, email address, optional phone number, password
          (stored hashed), and records of Terms acceptance (including version and time).
        </li>
        <li>
          <strong className="text-white">Workspace content:</strong> content you create, upload, or generate in Bloggr,
          including drafts, sources, business context, and settings needed to provide the service.
        </li>
        <li>
          <strong className="text-white">Billing:</strong> if you add a payment method, Stripe processes your card
          details. We do not store full card numbers. We may store a Stripe customer ID and limited payment-method
          metadata.
        </li>
        <li>
          <strong className="text-white">Usage and device data:</strong> log data, approximate location derived from IP
          address, browser type, and product analytics events that help us operate and improve Bloggr.
        </li>
        <li>
          <strong className="text-white">Support communications:</strong> messages you send to{" "}
          <a href="mailto:support@bloggr.io">support@bloggr.io</a>.
        </li>
      </ul>

      <h2>3. How we use information</h2>
      <p>We use personal information to:</p>
      <ul>
        <li>Create and secure your account, verify your email, and provide Bloggr</li>
        <li>Review early-access / beta signup requests and notify you when access is granted</li>
        <li>Process payments and manage subscriptions through Stripe</li>
        <li>Generate AI Output you request, using the prompts and context you provide</li>
        <li>Send transactional email (verification, approval, billing, and service notices)</li>
        <li>Monitor errors, security, and product performance</li>
        <li>Comply with law and enforce our Terms</li>
      </ul>
      <p>
        Where UK GDPR applies, we typically rely on contract (to provide the service), legitimate interests (to secure
        and improve Bloggr), consent (where we ask for it, including certain cookies), and legal obligation.
      </p>

      <h2>4. AI processing</h2>
      <p>
        When you use AI features, we send the prompts and relevant workspace context you provide to OpenAI so we can
        return AI Output to you. Do not include information in prompts or uploads that you are not allowed to share with
        a processor. You remain responsible for reviewing AI Output before you publish or rely on it.
      </p>

      <h2>5. Who we share information with</h2>
      <p>We share personal information with the service providers we need to operate Bloggr, including:</p>
      <ul>
        <li>Stripe — payments</li>
        <li>OpenAI — AI features</li>
        <li>Hetzner — hosting</li>
        <li>AWS — content delivery</li>
        <li>Brevo — email</li>
        <li>PostHog — product analytics</li>
        <li>Sentry — error monitoring</li>
      </ul>
      <p>
        These providers process data on our instructions. We may also disclose information if required by law, to
        protect Bloggr or our users, or in connection with a reorganisation of the business.
      </p>
      <p>We do not sell your personal information.</p>

      <h2>6. International transfers</h2>
      <p>
        Some providers are located outside the United Kingdom. Where we transfer personal data internationally, we use
        appropriate safeguards required by applicable law, such as the UK International Data Transfer Addendum or
        equivalent contractual protections offered by those providers.
      </p>

      <h2>7. Retention</h2>
      <p>
        We keep account and workspace data while your account is active. If you delete your account, your content is
        removed from live view immediately and from backups within 30 days, except where we must retain information for
        legal, tax, or dispute-resolution reasons (for example, limited billing records).
      </p>

      <h2>8. Your rights</h2>
      <p>
        If you are in the UK or EEA, you may have the right to access, correct, delete, or restrict processing of your
        personal data, to object to certain processing, and to data portability. You may also complain to the UK
        Information Commissioner&apos;s Office or your local supervisory authority.
      </p>
      <p>
        To exercise a right, email <a href="mailto:support@bloggr.io">support@bloggr.io</a>. You can also delete your
        account from account settings where that feature is available.
      </p>

      <h2>9. Children</h2>
      <p>Bloggr is not for anyone under 16. We do not knowingly collect personal information from children under 16.</p>

      <h2>10. Changes</h2>
      <p>
        We may update this Privacy Policy. We will post the updated version on this page and, for material changes,
        notify you by email or in-app notice where reasonably possible.
      </p>

      <h2>11. Contact</h2>
      <p>
        Email: <a href="mailto:support@bloggr.io">support@bloggr.io</a>
      </p>
    </LegalPageShell>
  );
}
