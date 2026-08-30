import type { Metadata } from "next";
import Link from "next/link";
import { LegalPageShell } from "@/components/legal/legal-page-shell";
import { LEGAL_LAST_UPDATED } from "@/lib/legal/terms-version";

export const metadata: Metadata = {
  title: "Cookie Policy — Bloggr",
  description: "How Bloggr uses cookies and similar technologies.",
};

export default function CookiesPage() {
  return (
    <LegalPageShell title="Bloggr Cookie Policy" lastUpdated={LEGAL_LAST_UPDATED}>
      <p>
        This Cookie Policy explains how Bloggr Ltd (&quot;Bloggr&quot;, &quot;we&quot;, &quot;us&quot;) uses cookies and
        similar technologies on Bloggr. It should be read alongside our <Link href="/privacy">Privacy Policy</Link> and{" "}
        <Link href="/terms">Terms and Conditions</Link>.
      </p>
      <p>
        Questions: <a href="mailto:support@bloggr.io">support@bloggr.io</a>.
      </p>

      <h2>1. What cookies are</h2>
      <p>
        Cookies are small text files stored on your device. We also use similar technologies such as local storage. Some
        are strictly necessary for Bloggr to work. Others help us understand how the product is used.
      </p>

      <h2>2. Cookies we use</h2>
      <table>
        <thead>
          <tr>
            <th>Type</th>
            <th>Purpose</th>
            <th>Examples</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Strictly necessary</td>
            <td>Keep you signed in, protect the session, and remember essential preferences.</td>
            <td>Authentication cookie used so the app can recognise a logged-in session</td>
          </tr>
          <tr>
            <td>Functional</td>
            <td>Store settings you choose so the product works as you left it.</td>
            <td>Local storage for auth state and workspace context</td>
          </tr>
          <tr>
            <td>Analytics</td>
            <td>Understand how people use Bloggr so we can fix issues and improve the product.</td>
            <td>PostHog (product analytics)</td>
          </tr>
          <tr>
            <td>Operations</td>
            <td>Detect errors and keep the service reliable.</td>
            <td>Sentry (error monitoring)</td>
          </tr>
        </tbody>
      </table>
      <p>
        Third-party providers (including PostHog and Sentry) may set their own cookies or similar identifiers when their
        scripts run. See their privacy documentation for details.
      </p>

      <h2>3. How long cookies last</h2>
      <p>
        Session cookies expire when you close your browser or sign out. Persistent cookies and local storage remain
        until they expire, you clear them, or you delete your account data from the browser.
      </p>

      <h2>4. Managing cookies</h2>
      <p>
        You can block or delete cookies in your browser settings. If you block strictly necessary cookies, parts of
        Bloggr (including sign-in) may not work.
      </p>
      <p>
        Where we rely on analytics cookies that are not strictly necessary, we will only set them where required consent
        has been given, or we will configure those tools in a way that does not require consent under applicable law.
      </p>

      <h2>5. Changes</h2>
      <p>
        We may update this Cookie Policy when we change the cookies we use or the law requires it. The &quot;Last
        updated&quot; date at the top of this page will change when we do.
      </p>

      <h2>6. Contact</h2>
      <p>
        Email: <a href="mailto:support@bloggr.io">support@bloggr.io</a>
      </p>
    </LegalPageShell>
  );
}
