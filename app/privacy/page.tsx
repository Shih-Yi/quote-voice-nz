import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — KiwiSpeakQuote",
  description:
    "How KiwiSpeakQuote collects, uses, and protects your data under the New Zealand Privacy Act 2020.",
};

const LAST_UPDATED = "18 April 2026";

export default function PrivacyPage() {
  return (
    <main className="bg-bg min-h-screen py-12 px-4">
      <article className="max-w-3xl mx-auto bg-bg-white border border-border rounded-lg p-8 prose prose-slate">
        <h1 className="text-3xl font-bold text-text mb-2">Privacy Policy</h1>
        <p className="text-sm text-text-muted mb-8">Last updated: {LAST_UPDATED}</p>

        <section className="mb-8">
          <p className="text-text-muted">
            KiwiSpeakQuote (&quot;KSQ&quot;) handles your personal information in accordance with
            the New Zealand Privacy Act 2020. This policy explains what we collect, why, and how
            we protect it.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-text mb-3">1. What We Collect</h2>
          <ul className="list-disc pl-6 text-text-muted space-y-2">
            <li><strong>Account info:</strong> email, name, password hash (or Google OAuth identity).</li>
            <li><strong>Business profile:</strong> business name, phone, address, bank account, displayed on your quotes.</li>
            <li><strong>Quote data:</strong> customer details, line items, prices, signatures, photos you attach.</li>
            <li><strong>Audio recordings:</strong> processed for transcription and discarded after extraction (not stored long-term).</li>
            <li><strong>Billing info:</strong> handled by Stripe; we never see your full card number.</li>
            <li><strong>Technical data:</strong> IP, browser, device type, error logs (via Sentry, with PII stripped).</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-text mb-3">2. How We Use It</h2>
          <ul className="list-disc pl-6 text-text-muted space-y-2">
            <li>Provide the voice-to-quote service you signed up for;</li>
            <li>Process payments and manage your subscription;</li>
            <li>Send transactional emails (quote delivery, billing receipts, security alerts);</li>
            <li>Diagnose bugs and improve reliability;</li>
            <li>Comply with NZ tax and legal obligations.</li>
          </ul>
          <p className="text-text-muted mt-3">
            We do <strong>not</strong> sell your data or use it to train third-party AI models
            beyond the immediate transcription/extraction request.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-text mb-3">3. Third-Party Processors</h2>
          <p className="text-text-muted mb-3">
            We share the minimum data needed with these sub-processors:
          </p>
          <ul className="list-disc pl-6 text-text-muted space-y-2">
            <li><strong>Supabase</strong> — database, authentication, file storage</li>
            <li><strong>Vercel</strong> — application hosting</li>
            <li><strong>Groq</strong> — audio transcription (Whisper)</li>
            <li><strong>OpenAI</strong> — structured data extraction (GPT-4o-mini)</li>
            <li><strong>Stripe</strong> — payment processing and subscription billing</li>
            <li><strong>Resend</strong> — transactional email delivery</li>
            <li><strong>Sentry</strong> — error monitoring (PII-stripped)</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-text mb-3">4. Data Storage &amp; Location</h2>
          <p className="text-text-muted">
            Some processors store data outside New Zealand (US, EU). By using KSQ you consent to
            this transfer. We require all processors to meet equivalent privacy standards.
          </p>
          <p className="text-text-muted mt-3">
            Quotes are also stored locally on your device (IndexedDB) for offline access. You can
            clear this at any time via your browser settings.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-text mb-3">5. Retention</h2>
          <ul className="list-disc pl-6 text-text-muted space-y-2">
            <li>Audio recordings: deleted immediately after transcription.</li>
            <li>Quote data: kept while your account is active, then 7 years for NZ tax records.</li>
            <li>Billing records: 7 years (NZ Tax Administration Act).</li>
            <li>Account info: deleted within 30 days of account closure (excluding legally required records).</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-text mb-3">6. Your Rights</h2>
          <p className="text-text-muted mb-3">Under the NZ Privacy Act you can:</p>
          <ul className="list-disc pl-6 text-text-muted space-y-2">
            <li>Access the personal information we hold about you;</li>
            <li>Request correction of inaccurate information;</li>
            <li>Request deletion (subject to legal retention requirements);</li>
            <li>Complain to the{" "}
              <a
                href="https://www.privacy.org.nz/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Office of the Privacy Commissioner
              </a>
              .
            </li>
          </ul>
          <p className="text-text-muted mt-3">
            Email{" "}
            <a href="mailto:privacy@ksq.nz" className="text-primary hover:underline">
              privacy@ksq.nz
            </a>{" "}
            to exercise these rights.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-text mb-3">7. Cookies</h2>
          <p className="text-text-muted">
            We use only essential cookies for authentication and session management. No
            advertising or cross-site tracking cookies.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-text mb-3">8. Security</h2>
          <p className="text-text-muted">
            Passwords are hashed; data in transit is encrypted via TLS; database access is
            restricted via Supabase Row-Level Security. No system is perfectly secure — please
            report concerns to{" "}
            <a href="mailto:security@ksq.nz" className="text-primary hover:underline">
              security@ksq.nz
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-text mb-3">9. Changes</h2>
          <p className="text-text-muted">
            Material changes will be notified by email at least 30 days in advance. See also our{" "}
            <Link href="/terms" className="text-primary hover:underline">
              Terms of Service
            </Link>
            .
          </p>
        </section>
      </article>
    </main>
  );
}
