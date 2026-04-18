import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service — KiwiSpeakQuote",
  description:
    "Terms of Service for KiwiSpeakQuote (KSQ), the voice-to-quote app for New Zealand tradies.",
};

const LAST_UPDATED = "18 April 2026";

export default function TermsPage() {
  return (
    <main className="bg-bg min-h-screen py-12 px-4">
      <article className="max-w-3xl mx-auto bg-bg-white border border-border rounded-lg p-8 prose prose-slate">
        <h1 className="text-3xl font-bold text-text mb-2">Terms of Service</h1>
        <p className="text-sm text-text-muted mb-8">Last updated: {LAST_UPDATED}</p>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-text mb-3">1. About KiwiSpeakQuote</h2>
          <p className="text-text-muted">
            KiwiSpeakQuote (&quot;KSQ&quot;, &quot;we&quot;, &quot;our&quot;, &quot;us&quot;) is a voice-to-quote
            software service for New Zealand tradespeople. By creating an account or using the
            service, you agree to these Terms.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-text mb-3">2. Eligibility &amp; Account</h2>
          <p className="text-text-muted">
            You must be at least 18 years old and operating a lawful trade or business in New
            Zealand to use KSQ. You are responsible for keeping your login credentials secure and
            for all activity under your account.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-text mb-3">3. Subscriptions &amp; Billing</h2>
          <ul className="list-disc pl-6 text-text-muted space-y-2">
            <li>Paid plans are billed in NZD via Stripe on a monthly or annual cycle.</li>
            <li>Subscriptions auto-renew at the end of each billing period until cancelled.</li>
            <li>Pro and Team plans include a 14-day free trial on first subscription.</li>
            <li>Pricing may change with at least 30 days&apos; notice; existing paid periods are honoured at the original price.</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-text mb-3">4. Refunds &amp; Cancellations</h2>
          <p className="text-text-muted mb-3">
            You can cancel your subscription at any time from{" "}
            <Link href="/settings" className="text-primary hover:underline">
              Settings → Billing
            </Link>
            . Access continues until the end of your current paid period; we do not pro-rate
            unused time.
          </p>
          <p className="text-text-muted mb-3">
            <strong>Fees already paid are non-refundable</strong>, except where required by the
            New Zealand Consumer Guarantees Act 1993 or the Fair Trading Act 1986. If you believe
            the service has a material defect, contact us at{" "}
            <a href="mailto:support@ksq.nz" className="text-primary hover:underline">
              support@ksq.nz
            </a>{" "}
            and we&apos;ll work to resolve it.
          </p>
          <p className="text-text-muted">
            Free trials can be cancelled at any time before the trial ends with no charge.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-text mb-3">5. Acceptable Use</h2>
          <p className="text-text-muted mb-3">You agree not to:</p>
          <ul className="list-disc pl-6 text-text-muted space-y-2">
            <li>Use KSQ to create fraudulent, misleading, or unlawful quotes;</li>
            <li>Upload audio or content you do not have the right to record or share;</li>
            <li>Attempt to reverse-engineer, scrape, or overload the service;</li>
            <li>Resell or sublicense the service without our written permission.</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-text mb-3">6. Your Content</h2>
          <p className="text-text-muted">
            You retain ownership of quotes, customer details, audio recordings, and other content
            you submit. You grant us a limited licence to host, process, and transmit that
            content solely to operate the service for you (including transcription via Groq and
            extraction via OpenAI).
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-text mb-3">7. Service Availability</h2>
          <p className="text-text-muted">
            We aim for high availability but do not guarantee uninterrupted service. KSQ uses an
            offline-first architecture so you can keep working when connectivity is poor;
            unsynced data is stored locally on your device.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-text mb-3">8. Liability</h2>
          <p className="text-text-muted">
            To the maximum extent permitted by law, our total liability for any claim arising
            from your use of the service is limited to the fees you paid us in the 12 months
            before the claim. Nothing in these Terms limits rights you have under the Consumer
            Guarantees Act 1993 where it applies.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-text mb-3">9. Termination</h2>
          <p className="text-text-muted">
            We may suspend or terminate accounts that breach these Terms. You can delete your
            account at any time; we will retain billing records as required by NZ tax law.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-text mb-3">10. Governing Law</h2>
          <p className="text-text-muted">
            These Terms are governed by the laws of New Zealand. Disputes will be resolved in the
            New Zealand courts.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-text mb-3">11. Contact</h2>
          <p className="text-text-muted">
            Questions? Email{" "}
            <a href="mailto:support@ksq.nz" className="text-primary hover:underline">
              support@ksq.nz
            </a>
            . See also our{" "}
            <Link href="/privacy" className="text-primary hover:underline">
              Privacy Policy
            </Link>
            .
          </p>
        </section>
      </article>
    </main>
  );
}
