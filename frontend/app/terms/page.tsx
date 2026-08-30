import type { Metadata } from "next";
import Link from "next/link";
import { LegalPageShell } from "@/components/legal/legal-page-shell";
import { LEGAL_LAST_UPDATED } from "@/lib/legal/terms-version";

export const metadata: Metadata = {
  title: "Terms and Conditions — Bloggr",
  description: "Terms and Conditions for using Bloggr.",
};

export default function TermsPage() {
  return (
    <LegalPageShell title="Bloggr Terms and Conditions" lastUpdated={LEGAL_LAST_UPDATED}>
      <p>
        These Terms and Conditions (&quot;Terms&quot;) govern your use of Bloggr, operated by Bloggr Ltd, a company
        registered in the United Kingdom (&quot;Bloggr&quot;, &quot;we&quot;, &quot;us&quot;). By creating an account or
        using Bloggr, you agree to these Terms. If you don&apos;t agree, don&apos;t use the service.
      </p>
      <p>
        This document should be read alongside our <Link href="/privacy">Privacy Policy</Link> and{" "}
        <Link href="/cookies">Cookie Policy</Link>.
      </p>

      <h2>1. Who can use Bloggr</h2>
      <p>
        You must be at least 16 years old to use Bloggr. If you&apos;re using Bloggr on behalf of a company or
        organisation, you confirm you have authority to bind that organisation to these Terms.
      </p>

      <h2>2. Your account</h2>
      <p>
        You&apos;re responsible for keeping your login credentials secure and for all activity under your account. Tell
        us immediately at <a href="mailto:support@bloggr.io">support@bloggr.io</a> if you suspect unauthorised access.
      </p>

      <h2>3. Plans and pricing</h2>
      <p>Bloggr offers a free tier and three paid tiers:</p>
      <table>
        <thead>
          <tr>
            <th>Plan</th>
            <th>Price</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Solo</td>
            <td>£19/month (or equivalent annual rate)</td>
          </tr>
          <tr>
            <td>Pro</td>
            <td>£49/month (or equivalent annual rate)</td>
          </tr>
          <tr>
            <td>Agency</td>
            <td>£99/month (or equivalent annual rate)</td>
          </tr>
        </tbody>
      </table>
      <p>
        All payments are processed by Stripe. We don&apos;t store your card details. Paid plans renew automatically at
        the end of each billing period (monthly or annual, depending on what you selected) unless you cancel before
        renewal. We may change pricing with at least 30 days&apos; notice; continued use after a price change takes
        effect means you accept the new price.
      </p>

      <h2>4. Cancellation and refunds</h2>
      <p>
        You can cancel at any time from your account settings. Cancellation takes effect at the end of your current
        billing period — you keep access until then, and we don&apos;t offer pro-rata refunds for unused time.
      </p>
      <p>
        If this is your first paid subscription with Bloggr, you can request a full refund within 14 days of your
        initial payment by emailing <a href="mailto:support@bloggr.io">support@bloggr.io</a>. This guarantee applies
        once per customer and doesn&apos;t apply to renewals.
      </p>
      <p>
        If, and for as long as, Bloggr is made available to consumers based in the EU or UK, nothing in this section
        limits any statutory cancellation rights those consumers have under local consumer protection law, to the extent
        those rights apply to digital services already in use.
      </p>

      <h2>5. Your content</h2>
      <p>
        You retain ownership of any content you create, write, or upload to Bloggr (&quot;Your Content&quot;). By using
        Bloggr, you grant us a limited licence to host, store, process, and display Your Content solely to provide the
        service to you.
      </p>
      <p>
        You&apos;re responsible for Your Content and confirm you have the right to use and share it, and that it
        doesn&apos;t infringe anyone else&apos;s rights or break the law.
      </p>

      <h2>6. AI-generated content</h2>
      <p>
        Bloggr includes features that generate content using AI (via OpenAI&apos;s API). For content generated this way
        (&quot;AI Output&quot;):
      </p>
      <ul>
        <li>
          In some jurisdictions, including the UK, AI-generated content without a human author may still qualify for
          copyright protection under provisions covering &quot;computer-generated works&quot; (in the UK, section 9(3)
          of the Copyright, Designs and Patents Act 1988), with authorship attributed to the person who made the
          arrangements necessary for the work&apos;s creation. To remove any doubt about who that is:{" "}
          <strong className="text-white">
            we assign to you, and you&apos;re treated as owning, all rights (including copyright, database rights, and
            any equivalent rights worldwide) that Bloggr or its personnel might otherwise hold in AI Output, effective
            automatically and immediately once the AI Output is generated for you.
          </strong>{" "}
          You don&apos;t need to take any further action for this assignment to take effect, though we&apos;ll sign any
          document reasonably needed to confirm it if you ask.
        </li>
        <li>
          In jurisdictions that don&apos;t recognise AI-generated content as protectable by copyright at all (for
          example, current US Copyright Office guidance on works without human authorship), no copyright exists for
          either of us to assign, and this section instead grants you an unrestricted, perpetual, worldwide licence to
          use, edit, publish, and commercialise the AI Output.
        </li>
        <li>
          We make no warranty about AI Output&apos;s originality, accuracy, or uniqueness. AI Output may resemble
          content generated for other users, since the same or similar prompts can produce similar results. You&apos;re
          responsible for reviewing AI Output before publishing or relying on it, including checking it doesn&apos;t
          infringe third-party rights — this matters in particular if you plan to resell or sublicense AI Output to your
          own clients (for example, on our Agency plan), since you&apos;ll be the one representing its originality
          downstream.
        </li>
      </ul>

      <h2>7. Acceptable use</h2>
      <p>You agree not to use Bloggr to:</p>
      <ul>
        <li>
          Post or generate content that&apos;s illegal, defamatory, harassing, hateful, or infringes someone else&apos;s
          intellectual property or privacy rights
        </li>
        <li>Impersonate any person or entity, or generate content falsely attributed to a real person</li>
        <li>Distribute malware, spam, or unsolicited bulk communications</li>
        <li>Scrape, reverse-engineer, or attempt to extract Bloggr&apos;s underlying code, models, or datasets</li>
        <li>Resell, sublicense, or white-label access to Bloggr without our written agreement</li>
        <li>Circumvent rate limits, usage caps, or other technical restrictions</li>
        <li>
          Use Bloggr, or any output from it, to build a competing product, or to train, fine-tune, distil, or otherwise
          improve any machine learning model
        </li>
        <li>
          Interfere with the operation or security of Bloggr, or attempt unauthorised access to other users&apos;
          accounts or data
        </li>
      </ul>
      <p>
        We may suspend or terminate accounts that breach this section, with or without notice depending on severity.
      </p>

      <h2>8. Service availability</h2>
      <p>
        We aim to keep Bloggr available and reliable, but we don&apos;t guarantee uninterrupted access. We may need to
        take the service down for maintenance, updates, or reasons outside our control, and we&apos;re not liable for
        losses arising from downtime.
      </p>

      <h2>9. Third-party services</h2>
      <p>
        Bloggr relies on third-party providers, including Stripe (payments), OpenAI (AI features), Hetzner (hosting),
        AWS (content delivery), Brevo (email), PostHog (analytics), and Sentry (error monitoring). We&apos;re not
        responsible for outages, errors, or changes to these providers&apos; services that affect Bloggr, though
        we&apos;ll work to minimise disruption.
      </p>

      <h2>10. Termination</h2>
      <p>
        You can delete your account at any time from your account settings. We may suspend or terminate your account for
        breach of these Terms, non-payment, or extended inactivity, with notice where reasonably possible.
      </p>
      <p>
        If we terminate your account for your breach of these Terms, you&apos;re not entitled to a refund for the
        remaining billing period. If we terminate your account for reasons other than your breach (for example,
        discontinuing the service), we&apos;ll refund a pro-rata amount for any unused portion of your current billing
        period.
      </p>
      <p>
        On termination (by you or by us), Your Content is deleted from live view immediately and removed from backups
        within 30 days, in line with our Privacy Policy — except where we&apos;re required to retain it for legal
        reasons.
      </p>

      <h2>11. Disclaimers</h2>
      <p>
        Bloggr is provided &quot;as is.&quot; To the extent permitted by law, we exclude all implied warranties,
        including fitness for a particular purpose and non-infringement. We don&apos;t warrant that Bloggr, or any AI
        Output it generates, will be error-free, accurate, or suitable for your specific purpose.
      </p>

      <h2>12. Liability</h2>
      <p>
        Nothing in these Terms limits liability for death or personal injury caused by negligence, fraud, or anything
        else that can&apos;t legally be excluded.
      </p>
      <p>
        Subject to that, our total liability to you arising from these Terms or your use of Bloggr is capped at the
        greater of (a) the fees you paid us in the 12 months before the claim, or (b) £100. We&apos;re not liable for
        indirect or consequential losses, including loss of profits, business, or data.
      </p>

      <h2>13. Force majeure</h2>
      <p>
        We&apos;re not liable for any failure or delay in performing our obligations where caused by something outside
        our reasonable control, including outages or failures of third-party providers we depend on (such as AWS,
        Stripe, or OpenAI), internet or power outages, natural disasters, war, or government action.
      </p>

      <h2>14. Indemnity</h2>
      <p>
        You agree to indemnify us against claims, losses, or damages arising from Your Content, your breach of these
        Terms, or your misuse of Bloggr.
      </p>

      <h2>15. Changes to these Terms</h2>
      <p>
        We may update these Terms from time to time. We&apos;ll notify you of material changes by email or in-app notice
        at least 14 days before they take effect. Continued use after that point means you accept the updated Terms.
      </p>

      <h2>16. Governing law</h2>
      <p>
        These Terms are governed by the laws of England and Wales, and any disputes are subject to the exclusive
        jurisdiction of the courts of England and Wales. If you&apos;re a consumer resident in the EU, mandatory
        consumer protection laws of your home country may still apply to you regardless of this clause.
      </p>

      <h2>17. Contact</h2>
      <p>
        Email: <a href="mailto:support@bloggr.io">support@bloggr.io</a>
      </p>
    </LegalPageShell>
  );
}
