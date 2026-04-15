"use client";

import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { QuoteCalculator } from "@/components/landing/QuoteCalculator";
import { CheckCircle2 } from "lucide-react";

export default function QuoteCalculatorPage() {
  return (
    <div className="min-h-screen bg-bg-white flex flex-col font-sans">
      <Header maxWidth="max-w-5xl" />

      <main className="flex-1 px-4 py-12 md:py-20">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
            <div className="flex flex-col gap-5">
              <h1 className="text-3xl md:text-4xl font-bold text-text leading-tight">
                How Much Is Slow Quoting Costing Your Business?
              </h1>
              <p className="text-lg text-text-muted leading-relaxed">
                Most NZ tradies don&apos;t realise how many hours — and jobs — they lose to manual quoting every week. This free calculator shows you the real cost in 60 seconds.
              </p>
              <ul className="space-y-3 text-text">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-secondary shrink-0 mt-0.5" />
                  <span>See exactly how many hours you waste on quotes each week</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-secondary shrink-0 mt-0.5" />
                  <span>Calculate the dollar cost of losing jobs to faster quoters</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-secondary shrink-0 mt-0.5" />
                  <span>Get a personalised comparison: your current process vs. voice quoting</span>
                </li>
              </ul>
              <p className="text-sm text-text-muted">Free. Takes 60 seconds. No sign-up required to start.</p>

              <div className="mt-6 p-5 bg-slate-50 rounded-xl border border-slate-200">
                <p className="text-sm text-text-muted leading-relaxed">
                  <span className="font-semibold text-text">Did you know?</span> NZ tradies who quote within 30 minutes of a site visit win up to 40% more jobs than those who wait until the next day. Speed is the single biggest factor in winning quotes — not price.
                </p>
              </div>
            </div>

            <QuoteCalculator />
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
