import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

export const metadata: Metadata = {
  title: "Best Tradify Alternative for NZ Tradies (2026) — QuoteTalk",
  description:
    "Looking for a Tradify alternative in NZ? QuoteTalk lets tradies send professional quotes in 60 seconds by voice. No laptop, no training, works offline. Free to try.",
  openGraph: {
    title: "Best Tradify Alternative for NZ Tradies (2026) — QuoteTalk",
    description:
      "QuoteTalk lets NZ tradies send professional quotes in 60 seconds by voice. Works offline. No training required.",
    url: "https://quotetalk.co.nz/compare/tradify-alternative",
  },
};

const schemaMarkup = {
  "@context": "https://schema.org",
  "@type": "Product",
  name: "QuoteTalk",
  description:
    "Voice-to-quote tool for NZ tradies. Send professional quotes in 60 seconds by voice. GST auto-calculated. Works offline.",
  url: "https://quotetalk.co.nz",
  offers: {
    "@type": "Offer",
    priceCurrency: "NZD",
    availability: "https://schema.org/InStock",
  },
  mainEntityOfPage: {
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "What is the best Tradify alternative in NZ?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "For NZ tradies who primarily need fast, professional quoting, QuoteTalk is the best Tradify alternative. It uses voice-to-quote technology to produce a professional quote in 60 seconds from your phone — no laptop, no training, works offline. Tradify is better suited to larger trade businesses that need full job management (scheduling, invoicing, timesheets).",
        },
      },
      {
        "@type": "Question",
        name: "Is QuoteTalk cheaper than Tradify?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "QuoteTalk is focused on quoting only, with a lower price point than Tradify. Tradify starts at $49 NZD/month/user for full job management. QuoteTalk is currently free during early access.",
        },
      },
      {
        "@type": "Question",
        name: "Does QuoteTalk work without internet?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes. QuoteTalk uses offline-first technology to store quotes locally on your phone when there's no signal. Quotes auto-sync when you reconnect. Tradify requires an internet connection to function.",
        },
      },
    ],
  },
};

const COMPARISON_FEATURES = [
  {
    feature: "Core focus",
    quotetalk: "Voice-to-quote: fast, on-site quoting",
    tradify: "Full job management: quotes, jobs, scheduling, invoicing",
  },
  {
    feature: "Quoting speed",
    quotetalk: "60 seconds by voice",
    tradify: "15–30 minutes (manual line-item entry)",
    quotetalkHighlight: true,
  },
  {
    feature: "Voice input",
    quotetalk: "Yes — core feature. Understands Kiwi slang",
    tradify: "No voice input",
    quotetalkHighlight: true,
  },
  {
    feature: "Works offline",
    quotetalk: "Yes — Zero-Bar Quoting™. Auto-syncs on reconnect",
    tradify: "No — requires internet connection",
    quotetalkHighlight: true,
  },
  {
    feature: "NZ localisation",
    quotetalk: "Built for NZ only: 15% GST, NZD, NZ spelling, Kiwi terminology",
    tradify: "NZ-adapted (originally Australian)",
    quotetalkHighlight: true,
  },
  {
    feature: "Learning curve",
    quotetalk: "Zero — if you can send a voice message, you can use it",
    tradify: "Tradify's own free training sessions suggest a learning curve",
    quotetalkHighlight: true,
  },
  {
    feature: "Scheduling & CRM",
    quotetalk: "No (quoting only)",
    tradify: "Yes — full job management",
    tradifyHighlight: true,
  },
  {
    feature: "Invoicing",
    quotetalk: "Basic (via quote to invoice)",
    tradify: "Full invoicing with Xero/MYOB integration",
    tradifyHighlight: true,
  },
  {
    feature: "Price",
    quotetalk: "Free during early access",
    tradify: "From $49 NZD/month/user",
    quotetalkHighlight: true,
  },
  {
    feature: "Mobile optimised",
    quotetalk: "Yes — designed for one-handed, on-site use",
    tradify: "Yes — mobile app available",
  },
  {
    feature: "Best for",
    quotetalk: "Sole traders and small teams focused on winning more quotes",
    tradify: "Small-to-medium trade businesses managing jobs end-to-end",
  },
];

export default function TradifyAlternativePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaMarkup) }}
      />
      <Header maxWidth="max-w-5xl" />

      <main className="bg-bg min-h-screen">
        {/* Hero */}
        <section className="bg-white border-b border-border px-4 py-12">
          <div className="max-w-5xl mx-auto">
            <div className="max-w-3xl">
              <p className="text-sm font-medium text-primary mb-2">Comparison</p>
              <h1 className="text-3xl md:text-4xl font-bold text-text mb-4">
                The Best Tradify Alternative for NZ Tradies (2026)
              </h1>
              <p className="text-lg text-text-muted mb-6">
                If you&apos;ve been using Tradify and found it too complex, too slow, or too expensive for
                what you actually need — you&apos;re not alone. This page compares QuoteTalk to Tradify
                honestly, so you can decide which tool is right for your business.
              </p>
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 text-sm mb-8">
                <strong className="text-text">Quick answer:</strong>{" "}
                <span className="text-text-muted">
                  If you need full job management (scheduling, CRM, timesheets, invoicing), Tradify is
                  a solid product. If what you actually need is to send professional quotes faster — and
                  you don&apos;t want to spend 20 minutes in an app every time — QuoteTalk is built for that.
                </span>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  href="/"
                  className="inline-flex items-center justify-center px-6 py-3 bg-primary text-white font-semibold rounded-lg hover:bg-primary-dark transition-colors"
                >
                  Try QuoteTalk free →
                </Link>
                <span className="text-sm text-text-muted self-center">
                  No credit card. No training. 60-second setup.
                </span>
              </div>
            </div>
          </div>
        </section>

        <div className="max-w-5xl mx-auto px-4 py-12 space-y-16">

          {/* Why Tradies Look for Alternatives */}
          <section>
            <h2 className="text-2xl font-bold text-text mb-6">Why Tradies Look for Tradify Alternatives</h2>
            <p className="text-text-muted mb-6">
              Tradify has over 20,000 customers and deserves its reputation as NZ&apos;s leading trade
              management software. But it&apos;s not the right tool for everyone.
            </p>
            <p className="text-text-muted mb-4 font-medium">
              The most common complaints from NZ tradies looking for alternatives:
            </p>
            <div className="space-y-4">
              {[
                {
                  title: "\"It takes too long.\"",
                  body: "Tradify requires you to open the app, create a client, create a job, add line items one by one, calculate GST, and then send. For a small job, that's 15–30 minutes.",
                },
                {
                  title: "\"It needs training.\"",
                  body: "Tradify offers free training sessions — which is a sign that the product isn't simple enough for a busy tradie to pick up and use in 60 seconds on site.",
                },
                {
                  title: "\"It's overkill for what I do.\"",
                  body: "Sole traders and small teams often don't need scheduling, CRM, GPS tracking, and reporting. They need to get a professional quote to the client fast.",
                },
                {
                  title: "\"It doesn't work without internet.\"",
                  body: "Canterbury and South Island tradies frequently work in areas with poor cell coverage. Tradify stops working without a connection.",
                },
                {
                  title: "\"The price adds up.\"",
                  body: "Tradify's per-user pricing starts at $49 NZD/month. For a 3-person team, that's $147/month for tools you may only use 20% of.",
                },
              ].map(({ title, body }) => (
                <div key={title} className="bg-white border border-border rounded-lg p-5">
                  <p className="font-semibold text-text mb-1">{title}</p>
                  <p className="text-text-muted text-sm">{body}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Comparison Table */}
          <section>
            <h2 className="text-2xl font-bold text-text mb-6">QuoteTalk vs Tradify — Key Differences</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-bg">
                    <th className="text-left p-3 border border-border font-semibold text-text w-1/4">Feature</th>
                    <th className="text-left p-3 border border-border font-semibold text-primary w-3/8">QuoteTalk</th>
                    <th className="text-left p-3 border border-border font-semibold text-text-muted w-3/8">Tradify</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON_FEATURES.map(({ feature, quotetalk, tradify, quotetalkHighlight, tradifyHighlight }) => (
                    <tr key={feature} className="hover:bg-bg/50">
                      <td className="p-3 border border-border text-text font-medium">{feature}</td>
                      <td className={`p-3 border border-border ${quotetalkHighlight ? "text-secondary font-medium" : "text-text-muted"}`}>
                        {quotetalk}
                      </td>
                      <td className={`p-3 border border-border ${tradifyHighlight ? "text-secondary font-medium" : "text-text-muted"}`}>
                        {tradify}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* What QuoteTalk Does Differently */}
          <section>
            <h2 className="text-2xl font-bold text-text mb-8">What QuoteTalk Does Differently</h2>
            <div className="space-y-10">
              <div>
                <h3 className="text-xl font-semibold text-text mb-4">
                  1. Voice-First Quoting — a genuinely different approach
                </h3>
                <p className="text-text-muted mb-4">
                  Tradify was designed for the office (or the van, with time to sit down). QuoteTalk was
                  designed for the driveway, the site, the moment you&apos;ve just scoped the job and need
                  to quote before you drive away.
                </p>
                <div className="grid sm:grid-cols-4 gap-3">
                  {[
                    ["1. Tap the mic", "One button"],
                    ["2. Speak your quote", "\"Two hours labour, replace the stopcock, $180 for parts, call-out fee $100\""],
                    ["3. Confirm", "AI parses your words into a professional quote with GST calculated"],
                    ["4. Send", "SMS, WhatsApp, or email before leaving"],
                  ].map(([step, detail]) => (
                    <div key={step} className="bg-bg border border-border rounded-lg p-4">
                      <p className="font-semibold text-text text-sm mb-1">{step}</p>
                      <p className="text-text-muted text-xs">{detail}</p>
                    </div>
                  ))}
                </div>
                <p className="text-text-muted text-sm mt-4">
                  The AI understands NZ plumbing, electrical, and building terminology. It recognises
                  &quot;two grand for the cylinder&quot; and knows that means $2,000. It calculates 15% GST.
                  It uses NZ spelling (Labour, not Labor).
                </p>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-text mb-4">
                  2. Zero-Bar Quoting™ — works without internet
                </h3>
                <p className="text-text-muted mb-4">
                  Every competing quoting tool requires an internet connection. QuoteTalk stores quotes
                  locally on your phone using IndexedDB — so you can record and generate quotes even
                  with zero cell signal.
                </p>
                <p className="text-text-muted">
                  When you get back in range, everything auto-syncs. You won&apos;t lose a quote because you
                  were in a basement, a rural paddock, or the West Coast.
                </p>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-text mb-4">
                  3. NZ-Only Focus
                </h3>
                <p className="text-text-muted mb-4">
                  Tradify was built in Australia and adapted for NZ. QuoteTalk was built from day one
                  for NZ tradies only — NZD, 15% GST, NZ spelling conventions, Placemakers and Mitre 10
                  pricing integration, and AI voice recognition tuned for Kiwi accents.
                </p>
                <p className="text-text-muted">
                  There are no compromises for &quot;global compatibility.&quot; Every decision was made for a NZ
                  tradie in mind.
                </p>
              </div>
            </div>
          </section>

          {/* Pricing Comparison */}
          <section>
            <h2 className="text-2xl font-bold text-text mb-6">Pricing Comparison</h2>
            <div className="overflow-x-auto mb-4">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-bg">
                    <th className="text-left p-3 border border-border font-semibold text-text">Product</th>
                    <th className="text-left p-3 border border-border font-semibold text-text">Price</th>
                    <th className="text-left p-3 border border-border font-semibold text-text">What You Get</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["QuoteTalk", "Free during early access", "Voice quoting, offline support, NZ GST, quote sharing", true],
                    ["Tradify Starter", "$49 NZD/month/user", "Full job management, scheduling, invoicing, CRM", false],
                    ["Tradify Growth", "$69 NZD/month/user", "+ Reporting, timesheets, more integrations", false],
                    ["Fergus", "From $79 NZD/month", "Full job management, invoicing, purchase orders", false],
                    ["ServiceM8", "From $29 USD/month", "Job management, with NZ adaptation", false],
                  ].map(([product, price, features, highlight]) => (
                    <tr key={product as string} className={highlight ? "bg-primary/5" : "hover:bg-bg/50"}>
                      <td className={`p-3 border border-border font-medium ${highlight ? "text-primary" : "text-text"}`}>
                        {product}
                      </td>
                      <td className="p-3 border border-border text-text">{price}</td>
                      <td className="p-3 border border-border text-text-muted">{features}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-sm text-text-muted bg-bg border border-border rounded-lg p-4">
              <strong className="text-text">The question isn&apos;t just price.</strong> It&apos;s which tool
              you&apos;ll actually use on site every day. A $49/month tool that takes 30 minutes per quote
              costs more in your time than a free tool that takes 60 seconds.
            </p>
          </section>

          {/* Who It's For */}
          <section>
            <h2 className="text-2xl font-bold text-text mb-6">Who QuoteTalk Is Best For</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white border-2 border-primary rounded-lg p-6">
                <h3 className="font-semibold text-primary mb-4">QuoteTalk is the right choice if:</h3>
                <ul className="space-y-2">
                  {[
                    "You're a sole trader or a team of 1–5 tradies",
                    "Quoting is your biggest admin pain point",
                    "You work in areas with unreliable cell coverage",
                    "You're spending 1–3 hours per night writing up quotes",
                    "You've tried Tradify or Fergus and found them too complicated",
                    "You want to start quoting faster without a learning curve",
                  ].map((item) => (
                    <li key={item} className="flex gap-2 text-sm">
                      <span className="text-secondary font-bold mt-0.5">✓</span>
                      <span className="text-text-muted">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-white border border-border rounded-lg p-6">
                <h3 className="font-semibold text-text mb-4">Tradify is the better choice if:</h3>
                <ul className="space-y-2">
                  {[
                    "You need full job lifecycle management (enquiry → quote → job → invoice → payment)",
                    "You manage a team and need scheduling and timesheets",
                    "You need deep Xero or MYOB integration",
                    "You're a trade business with $1M+ revenue that needs reporting",
                  ].map((item) => (
                    <li key={item} className="flex gap-2 text-sm">
                      <span className="text-text-muted/50 font-bold mt-0.5">→</span>
                      <span className="text-text-muted">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <p className="text-sm text-text-muted mt-4">
              These tools solve different problems. For many sole traders, QuoteTalk handles the hardest
              part of the day (quoting fast) at a fraction of the complexity and cost.
            </p>
          </section>

          {/* CTA */}
          <section className="bg-primary rounded-2xl p-8 text-white">
            <h2 className="text-2xl font-bold mb-3">Try QuoteTalk Free</h2>
            <p className="text-white/80 mb-2">No credit card. No commitment. No training sessions.</p>
            <p className="text-white/80 mb-6">
              If you&apos;re a NZ tradie spending too long on quotes — give QuoteTalk 60 seconds. That&apos;s
              all it takes.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href="/"
                className="inline-flex items-center justify-center px-6 py-3 bg-white text-primary font-semibold rounded-lg hover:bg-white/90 transition-colors"
              >
                Get early access free →
              </Link>
              <Link
                href="/"
                className="inline-flex items-center justify-center px-6 py-3 border border-white/30 text-white font-medium rounded-lg hover:bg-white/10 transition-colors"
              >
                Watch the 60-second demo →
              </Link>
            </div>
          </section>

          {/* FAQ */}
          <section>
            <h2 className="text-2xl font-bold text-text mb-8">Frequently Asked Questions</h2>
            <div className="space-y-6">
              {[
                {
                  q: "Is QuoteTalk a full replacement for Tradify?",
                  a: "No. QuoteTalk focuses on one thing: getting professional quotes out fast by voice. If you need full job management — scheduling, timesheets, CRM, invoicing — Tradify covers more ground. Many tradies use QuoteTalk for quoting and a separate tool for invoicing.",
                },
                {
                  q: "Does QuoteTalk integrate with Xero?",
                  a: "Not in the current version. QuoteTalk generates quotes as PDF files you can share directly. Xero integration is on the roadmap.",
                },
                {
                  q: "Can I import my Tradify client list into QuoteTalk?",
                  a: "Not automatically in the current version. During early access, client details are added when you create a quote. Bulk import is planned for a future release.",
                },
                {
                  q: "Does QuoteTalk work on Android and iPhone?",
                  a: "Yes — QuoteTalk is a web app that works in any mobile browser (Safari on iPhone, Chrome on Android). No app store download required.",
                },
                {
                  q: "What happens to my quotes if I cancel?",
                  a: "Your quotes are stored as PDF files that you can download at any time. You keep your quotes.",
                },
              ].map(({ q, a }) => (
                <div key={q} className="border-b border-border pb-6">
                  <h3 className="font-semibold text-text mb-2">{q}</h3>
                  <p className="text-text-muted">{a}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Related Links */}
          <section>
            <h2 className="text-2xl font-bold text-text mb-4">Related Resources</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <Link
                href="/templates/plumbing-quote-nz"
                className="block bg-white border border-border rounded-lg p-5 hover:border-primary transition-colors"
              >
                <p className="font-semibold text-text mb-1">Free Plumbing Quote Templates</p>
                <p className="text-sm text-text-muted">Download free NZ plumbing quote templates with GST</p>
              </Link>
              <Link
                href="/"
                className="block bg-white border border-border rounded-lg p-5 hover:border-primary transition-colors"
              >
                <p className="font-semibold text-text mb-1">Try QuoteTalk free</p>
                <p className="text-sm text-text-muted">60-second voice quoting for NZ tradies</p>
              </Link>
            </div>
          </section>

        </div>
      </main>

      <Footer />
    </>
  );
}
