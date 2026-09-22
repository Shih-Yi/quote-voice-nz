import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

export const metadata: Metadata = {
  title: "Free Plumbing Quote Template NZ — Download or Use Online | QuoteTalk",
  description:
    "Download a free plumbing quote template for NZ. GST-calculated, professional layout. Common line items included. Or generate quotes by voice in 60 seconds with QuoteTalk.",
  openGraph: {
    title: "Free Plumbing Quote Template NZ — Download or Use Online",
    description:
      "Download a free plumbing quote template for NZ. GST-calculated, professional layout. Common line items included.",
    url: "https://quotetalk.co.nz/templates/plumbing-quote-nz",
  },
};

const schemaMarkup = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "How to Create a Plumbing Quote in NZ",
  description:
    "Step-by-step guide to creating a professional plumbing quote for NZ clients, including GST calculation and common line items.",
  totalTime: "PT5M",
  step: [
    {
      "@type": "HowToStep",
      name: "List the materials",
      text: "Detail all parts and materials with NZD costs. Include supplier (e.g., Placemakers, Tradelink) and part numbers where possible.",
    },
    {
      "@type": "HowToStep",
      name: "Calculate labour hours",
      text: "Estimate time on site. NZ plumber rates range from $80–$130/hour depending on region and job type.",
    },
    {
      "@type": "HowToStep",
      name: "Add call-out and travel",
      text: "Include your call-out fee (typically $80–$150 in NZ) and travel time if applicable.",
    },
    {
      "@type": "HowToStep",
      name: "Calculate GST",
      text: "Add 15% GST to the subtotal for GST-exclusive quotes. Or state 'GST inclusive' with the amount included in your pricing.",
    },
    {
      "@type": "HowToStep",
      name: "Send the quote",
      text: "Send within 24 hours of the site visit. First to quote wins approximately 60% of jobs in NZ.",
    },
  ],
  mainEntityOfPage: {
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "How much should I charge for a plumbing job in NZ?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "NZ plumber hourly rates range from $80–$130/hour in 2026. Most plumbers also charge a call-out fee of $80–$150. Hot water cylinder replacement typically ranges from $1,200–$2,500 including parts and labour.",
        },
      },
      {
        "@type": "Question",
        name: "Should my plumbing quote be GST inclusive or exclusive?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Both are acceptable in NZ. Most tradies quote GST-exclusive (+ GST) for clarity. Always state which applies on your quote. For consumer clients, GST-inclusive is often clearer. For business clients, GST-exclusive is standard.",
        },
      },
      {
        "@type": "Question",
        name: "What should a plumbing quote include?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "A NZ plumbing quote should include: your business name, NZBN, and contact details; the client's name and address; job description; materials list with costs; labour hours and rate; call-out fee; GST breakdown; total; quote validity period; and payment terms.",
        },
      },
    ],
  },
};

export default function PlumbingQuoteTemplatePage() {
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
              <p className="text-sm font-medium text-primary mb-2">Free Template</p>
              <h1 className="text-3xl md:text-4xl font-bold text-text mb-4">
                Free Plumbing Quote Template NZ — Download or Use Online
              </h1>
              <p className="text-lg text-text-muted mb-8">
                Download a free plumbing quote template designed for NZ tradies — with GST
                calculated, professional layout, and common line items pre-filled. Or skip the
                template entirely and generate your next plumbing quote by voice in 60 seconds
                with QuoteTalk.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  href="/"
                  className="inline-flex items-center justify-center px-6 py-3 bg-primary text-white font-semibold rounded-lg hover:bg-primary-dark transition-colors"
                >
                  Generate a plumbing quote by voice →
                </Link>
                <span className="text-sm text-text-muted self-center">
                  60 seconds. GST auto-calculated. Send from your phone.
                </span>
              </div>
            </div>
          </div>
        </section>

        <div className="max-w-5xl mx-auto px-4 py-12 space-y-16">

          {/* What's Included */}
          <section>
            <h2 className="text-2xl font-bold text-text mb-6">
              What&apos;s Included in This Plumbing Quote Template
            </h2>
            <p className="text-text-muted mb-6">
              This template is built specifically for NZ plumbers, not adapted from a US or UK
              template. It includes:
            </p>
            <ul className="space-y-3 mb-8">
              {[
                ["Your business details", "name, NZBN, contact info, payment terms"],
                ["Client information section", "name, address, job site address"],
                ["Job description", "space for a brief scope of work"],
                ["Materials list", "line items with quantity, unit price, and total"],
                ["Labour", "hours, rate, and total"],
                ["Call-out fee", "included as a separate line item"],
                ["GST calculation", "15% NZ GST, clearly broken down (inclusive or exclusive)"],
                ["Total", "subtotal, GST, and grand total in NZD"],
                ["Quote validity", "standard 30-day expiry field"],
                ["Terms and conditions", "basic payment terms section"],
              ].map(([label, detail]) => (
                <li key={label} className="flex gap-3">
                  <span className="text-secondary font-bold mt-0.5">✓</span>
                  <span>
                    <strong className="text-text">{label}</strong>
                    <span className="text-text-muted"> — {detail}</span>
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href="/"
                className="inline-flex items-center justify-center px-5 py-2.5 bg-primary text-white font-medium rounded-lg hover:bg-primary-dark transition-colors text-sm"
              >
                Use Online — Free
              </Link>
              <Link
                href="/"
                className="inline-flex items-center justify-center px-5 py-2.5 border border-border text-text font-medium rounded-lg hover:bg-bg transition-colors text-sm"
              >
                Download PDF Template
              </Link>
              <Link
                href="/"
                className="inline-flex items-center justify-center px-5 py-2.5 border border-border text-text font-medium rounded-lg hover:bg-bg transition-colors text-sm"
              >
                Download Word Doc (.docx)
              </Link>
            </div>
          </section>

          {/* Line Items */}
          <section>
            <h2 className="text-2xl font-bold text-text mb-6">
              Common Plumbing Line Items for NZ Quotes (2026)
            </h2>
            <p className="text-text-muted mb-6">
              Every plumbing job is different, but these are the line items NZ plumbers most
              commonly include on quotes. Use this as your checklist.
            </p>

            <h3 className="text-lg font-semibold text-text mb-3">Labour</h3>
            <div className="overflow-x-auto mb-8">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-bg">
                    <th className="text-left p-3 border border-border font-semibold text-text">Line Item</th>
                    <th className="text-left p-3 border border-border font-semibold text-text">Typical Rate (NZD)</th>
                    <th className="text-left p-3 border border-border font-semibold text-text">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Plumber labour — general", "$80–$130/hour", "Varies by region; Auckland higher end"],
                    ["Apprentice labour", "$45–$65/hour", "When applicable"],
                    ["After-hours rate", "$130–$200/hour", "Weekend/public holiday premium"],
                    ["Call-out fee", "$80–$150 flat", "Include even if first hour is charged separately"],
                    ["Travel (per hour or per km)", "$0.95–$1.20/km", "Or $80–$100/hour of travel"],
                  ].map(([item, rate, note]) => (
                    <tr key={item} className="hover:bg-bg/50">
                      <td className="p-3 border border-border text-text">{item}</td>
                      <td className="p-3 border border-border text-text font-medium">{rate}</td>
                      <td className="p-3 border border-border text-text-muted">{note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h3 className="text-lg font-semibold text-text mb-3">Common Materials (2026 NZD Estimates)</h3>
            <div className="overflow-x-auto mb-6">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-bg">
                    <th className="text-left p-3 border border-border font-semibold text-text">Item</th>
                    <th className="text-left p-3 border border-border font-semibold text-text">Typical Cost Range</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Hot water cylinder (180L)", "$800–$1,400 supply"],
                    ["Flexi hoses (pair)", "$25–$45"],
                    ["Ball valve", "$30–$80"],
                    ["PEX pipe (per metre)", "$4–$9"],
                    ["Cistern suite", "$250–$600 supply"],
                    ["Tapware (mid-range)", "$150–$400 supply"],
                    ["Shower mixer", "$180–$500 supply"],
                    ["Waste trap", "$25–$60"],
                  ].map(([item, range]) => (
                    <tr key={item} className="hover:bg-bg/50">
                      <td className="p-3 border border-border text-text">{item}</td>
                      <td className="p-3 border border-border text-text font-medium">{range}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-sm text-text-muted bg-bg border border-border rounded-lg p-4">
              <strong>Note:</strong> Material prices fluctuate. Always verify with your Placemakers,
              Tradelink, or Mico supplier before quoting. These ranges are indicative for 2026.
            </p>

            <h3 className="text-lg font-semibold text-text mb-3 mt-8">Common Job Types and Rough Pricing Ranges</h3>
            <div className="overflow-x-auto mb-4">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-bg">
                    <th className="text-left p-3 border border-border font-semibold text-text">Job Type</th>
                    <th className="text-left p-3 border border-border font-semibold text-text">Typical Quote Range (NZD, incl. GST)</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Hot water cylinder replacement", "$1,500–$2,800"],
                    ["Tap replacement (standard)", "$180–$350"],
                    ["Toilet suite replacement", "$500–$900"],
                    ["Shower replacement", "$1,200–$3,500"],
                    ["Burst pipe repair", "$200–$600"],
                    ["New bathroom fit-out", "$8,000–$25,000+"],
                    ["Full house re-pipe", "$12,000–$35,000+"],
                  ].map(([job, range]) => (
                    <tr key={job} className="hover:bg-bg/50">
                      <td className="p-3 border border-border text-text">{job}</td>
                      <td className="p-3 border border-border text-text font-medium">{range}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-sm text-text-muted">
              These ranges assume Auckland/major-city pricing. Canterbury and regional NZ rates are typically 10–20% lower.
            </p>
          </section>

          {/* How to Fill In */}
          <section>
            <h2 className="text-2xl font-bold text-text mb-6">How to Fill In Your Plumbing Quote</h2>
            <div className="space-y-6">
              {[
                {
                  step: "1",
                  title: "Start with your details",
                  body: "Fill in your business name, NZBN number, phone number, and email. If you're GST-registered, include your GST number. This is a legal requirement for GST-registered businesses quoting over $50.",
                },
                {
                  step: "2",
                  title: "Add client and job details",
                  body: "Client name, job address, and contact phone number. Include a brief one-sentence scope of work — \"Supply and install replacement hot water cylinder, disconnect and remove old unit.\"",
                },
                {
                  step: "3",
                  title: "List your materials",
                  body: "Go through each part you'll need. Be specific — vague line items lead to scope disputes. Include quantities and per-unit cost. Link to your supplier price list where possible.",
                },
                {
                  step: "4",
                  title: "Add your labour",
                  body: "Estimate your hours. Add a line for your call-out fee separately — this protects you if the job turns out to be simpler than expected.",
                },
                {
                  step: "5",
                  title: "Calculate GST",
                  body: "If quoting GST-exclusive: add a line \"GST (15%)\" as your subtotal × 0.15. If quoting GST-inclusive: note \"Prices include GST\" at the top.",
                },
                {
                  step: "6",
                  title: "Set a validity period",
                  body: "Standard in NZ is 30 days. Material prices change — protect yourself with a clear expiry date.",
                },
                {
                  step: "7",
                  title: "Send it fast",
                  body: "First to quote wins. If you can send the quote the same day (or before you leave the site), your win rate improves significantly.",
                },
              ].map(({ step, title, body }) => (
                <div key={step} className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center font-bold text-sm">
                    {step}
                  </div>
                  <div>
                    <h3 className="font-semibold text-text mb-1">{title}</h3>
                    <p className="text-text-muted">{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* GST Section */}
          <section>
            <h2 className="text-2xl font-bold text-text mb-6">
              GST on Plumbing Quotes: Inclusive vs Exclusive — What to Use
            </h2>
            <p className="text-text-muted mb-6">
              GST handling is one of the most common errors on NZ trade quotes. Here&apos;s when to use each:
            </p>
            <div className="grid md:grid-cols-2 gap-6 mb-6">
              <div className="bg-white border border-border rounded-lg p-6">
                <h3 className="font-semibold text-text mb-2">GST Exclusive (+ GST)</h3>
                <p className="text-sm text-text-muted mb-3">
                  <strong>Best for:</strong> Quoting business clients (companies, property managers, developers)
                </p>
                <p className="text-sm font-mono bg-bg rounded p-3 text-text mb-3">
                  Subtotal: $1,200.00<br />
                  GST (15%): $180.00<br />
                  <strong>Total: $1,380.00</strong>
                </p>
                <p className="text-sm text-text-muted">
                  Business clients can claim back GST input credits — they want to see the amounts separately.
                </p>
              </div>
              <div className="bg-white border border-border rounded-lg p-6">
                <h3 className="font-semibold text-text mb-2">GST Inclusive</h3>
                <p className="text-sm text-text-muted mb-3">
                  <strong>Best for:</strong> Quoting homeowners and private clients
                </p>
                <p className="text-sm font-mono bg-bg rounded p-3 text-text mb-3">
                  Total: $1,380.00<br />
                  <span className="text-text-muted">(GST included)</span>
                </p>
                <p className="text-sm text-text-muted">
                  Simpler for clients who can&apos;t claim GST. Clearer total amount upfront.
                </p>
              </div>
            </div>
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 text-sm">
              <strong className="text-primary">Quick NZ GST tip:</strong>{" "}
              <span className="text-text-muted">
                GST-exclusive total × 1.15 = GST-inclusive total. GST-inclusive total ÷ 1.15 = GST-exclusive total.
              </span>
              <span className="text-text-muted ml-2">
                Use our{" "}
                <Link href="/tools/gst-calculator" className="text-primary hover:underline">
                  NZ GST calculator
                </Link>{" "}
                to calculate quickly.
              </span>
            </div>
          </section>

          {/* Tips */}
          <section>
            <h2 className="text-2xl font-bold text-text mb-6">Tips for Winning More Plumbing Jobs with Your Quotes</h2>
            <div className="space-y-4">
              {[
                {
                  n: "1",
                  title: "Quote on the same day",
                  body: "NZ homeowners and project managers often get 3–5 quotes. The first professional quote that arrives usually wins — price is secondary to speed and professionalism.",
                },
                {
                  n: "2",
                  title: "Be specific about scope",
                  body: "Vague quotes (\"plumbing work — $X\") lead to disputes. Itemise clearly. Clients trust plumbers who explain what they're doing.",
                },
                {
                  n: "3",
                  title: "Include a validity period",
                  body: "Material prices move. A quote without an expiry can come back to bite you 3 months later when copper prices have jumped.",
                },
                {
                  n: "4",
                  title: "Add photos to expensive quotes",
                  body: "For jobs over $5,000, include photos of the existing conditions. It justifies your price and shows you've actually assessed the job.",
                },
                {
                  n: "5",
                  title: "Send in a format the client can open",
                  body: "PDF is the safest format. Avoid sending a Word document — formatting breaks across devices. A professional PDF shows you're organised.",
                },
              ].map(({ n, title, body }) => (
                <div key={n} className="bg-white border border-border rounded-lg p-5">
                  <h3 className="font-semibold text-text mb-1">
                    <span className="text-primary">{n}.</span> {title}
                  </h3>
                  <p className="text-text-muted text-sm">{body}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Voice Quoting CTA */}
          <section className="bg-primary rounded-2xl p-8 text-white">
            <h2 className="text-2xl font-bold mb-4">A Faster Way: Generate Plumbing Quotes by Voice</h2>
            <p className="text-white/80 mb-6">
              Filling in a template every time is still time. If you&apos;re doing 5–10 quotes a week,
              that&apos;s hours of admin.
            </p>
            <p className="text-white/80 mb-6">
              QuoteTalk lets you speak your plumbing quote out loud — while you&apos;re still on site,
              even with zero signal — and it produces a professional, GST-calculated PDF in 60 seconds.
            </p>
            <div className="grid sm:grid-cols-2 gap-4 mb-8">
              {[
                ["Tap the mic.", "Start recording."],
                ["Speak naturally.", "\"Two grand for the hot water cylinder, 150 bucks for callout, three hours labour at $100.\""],
                ["Review and confirm.", "QuoteTalk parses your words into line items with GST calculated."],
                ["Send.", "Share via SMS, WhatsApp, or email before leaving the driveway."],
              ].map(([step, detail], i) => (
                <div key={i} className="bg-white/10 rounded-lg p-4">
                  <p className="font-semibold text-sm mb-1">{i + 1}. {step}</p>
                  <p className="text-white/70 text-sm">{detail}</p>
                </div>
              ))}
            </div>
            <p className="text-white/70 text-sm mb-6">
              QuoteTalk understands Kiwi plumbing terminology, handles 15% NZ GST automatically,
              and works offline — so you can quote even when you&apos;re in that basement with no signal.
            </p>
            <Link
              href="/"
              className="inline-flex items-center justify-center px-6 py-3 bg-white text-primary font-semibold rounded-lg hover:bg-white/90 transition-colors"
            >
              Get early access free — no credit card →
            </Link>
          </section>

          {/* FAQ */}
          <section>
            <h2 className="text-2xl font-bold text-text mb-8">Frequently Asked Questions</h2>
            <div className="space-y-6">
              {[
                {
                  q: "How much should I charge per hour as a plumber in NZ?",
                  a: "NZ plumber hourly rates in 2026 range from $80–$130/hour for a qualified plumber. In Auckland and Wellington, rates tend to be at the higher end. Regional areas (Canterbury, Waikato) typically run $80–$110/hour. Always factor in your overhead costs, insurance, and tool costs when setting your rate.",
                },
                {
                  q: "Do I need to include my NZBN on a quote?",
                  a: "A New Zealand Business Number (NZBN) is not legally required on a quote, but it adds credibility and is required on formal tax invoices. If you're GST-registered, you must include your GST registration number on any invoice over $50.",
                },
                {
                  q: "What's the difference between a quote and an estimate?",
                  a: "In NZ, a quote is a fixed price — once accepted, you're bound to that price (with reasonable variation for unforeseen work). An estimate is a rough guide and can change. Always be clear on your document which type you're providing to avoid disputes.",
                },
                {
                  q: "How long should a plumbing quote be valid for?",
                  a: "30 days is standard in NZ. For large jobs (full bathroom, new build), 14 days is reasonable given material price volatility. Always include the expiry date clearly on the quote.",
                },
                {
                  q: "Should I charge for a quote?",
                  a: "Most residential plumbers in NZ offer free quotes for standard jobs. For large scopes (full renovations, new builds), charging a site visit fee ($80–$150) is acceptable and increasingly common. If you charge, state it clearly upfront.",
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
            <div className="grid sm:grid-cols-3 gap-4">
              <Link
                href="/tools/gst-calculator"
                className="block bg-white border border-border rounded-lg p-5 hover:border-primary transition-colors"
              >
                <p className="font-semibold text-text mb-1">NZ GST Calculator</p>
                <p className="text-sm text-text-muted">Calculate GST quickly for any quote amount</p>
              </Link>
              <Link
                href="/compare/tradify-alternative"
                className="block bg-white border border-border rounded-lg p-5 hover:border-primary transition-colors"
              >
                <p className="font-semibold text-text mb-1">Quoting software for plumbers</p>
                <p className="text-sm text-text-muted">Compare QuoteTalk vs Tradify for NZ tradies</p>
              </Link>
              <Link
                href="/"
                className="block bg-white border border-border rounded-lg p-5 hover:border-primary transition-colors"
              >
                <p className="font-semibold text-text mb-1">Voice-to-Quote Demo</p>
                <p className="text-sm text-text-muted">See how to quote a plumbing job in 60 seconds</p>
              </Link>
            </div>
          </section>

        </div>
      </main>

      <Footer />
    </>
  );
}
