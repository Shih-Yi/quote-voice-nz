"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Clock,
  DollarSign,
  ArrowRight,
  CheckCircle2,
  Share2,
  ChevronLeft,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type Trade = "plumber" | "electrician" | "builder" | "landscaper" | "painter" | "other";

interface CalcInputs {
  trade: Trade | null;
  quotesPerWeek: number;
  minsPerQuote: number;
  avgJobValue: number;
}

interface CalcResults {
  weeklyHours: number;
  monthlyHours: number;
  annualHours: number;
  annualJobsLost: number;
  annualRevenueLost: number;
  churquoteWeeklyMins: number;
  timeSavedWeeklyHours: number;
  timeSavedAnnualHours: number;
  eveningsSaved: number;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const TRADES: { value: Trade; label: string }[] = [
  { value: "plumber", label: "Plumber" },
  { value: "electrician", label: "Electrician" },
  { value: "builder", label: "Builder" },
  { value: "landscaper", label: "Landscaper" },
  { value: "painter", label: "Painter" },
  { value: "other", label: "Other Trade" },
];

const STEP_COUNT = 3;

/* ------------------------------------------------------------------ */
/*  Calculation                                                        */
/* ------------------------------------------------------------------ */

function calculate(inputs: CalcInputs): CalcResults {
  const weeklyHours = (inputs.quotesPerWeek * inputs.minsPerQuote) / 60;
  const monthlyHours = weeklyHours * 4.33;
  const annualHours = weeklyHours * 52;
  const annualJobsLost = inputs.quotesPerWeek * 52 * 0.15;
  const annualRevenueLost = annualJobsLost * inputs.avgJobValue;
  const churquoteWeeklyMins = inputs.quotesPerWeek * 1;
  const timeSavedWeeklyHours = weeklyHours - churquoteWeeklyMins / 60;
  const timeSavedAnnualHours = timeSavedWeeklyHours * 52;
  const eveningsSaved = Math.round(timeSavedAnnualHours / 3); // ~3hrs = 1 evening

  return {
    weeklyHours,
    monthlyHours,
    annualHours,
    annualJobsLost,
    annualRevenueLost,
    churquoteWeeklyMins,
    timeSavedWeeklyHours,
    timeSavedAnnualHours,
    eveningsSaved,
  };
}

/* ------------------------------------------------------------------ */
/*  Formatting helpers                                                 */
/* ------------------------------------------------------------------ */

function fmtHours(n: number): string {
  if (n < 1) return `${Math.round(n * 60)} min`;
  return `${n.toFixed(1)} hrs`;
}

function fmtDollars(n: number): string {
  return `$${Math.round(n).toLocaleString("en-NZ")}`;
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export function QuoteCalculator({ className = "" }: { className?: string }) {
  const [step, setStep] = useState(0); // 0-3 = inputs, 4 = results
  const [inputs, setInputs] = useState<CalcInputs>({
    trade: null,
    quotesPerWeek: 8,
    minsPerQuote: 25,
    avgJobValue: 1500,
  });
  const [results, setResults] = useState<CalcResults | null>(null);

  const canAdvance = (): boolean => {
    switch (step) {
      case 0: return inputs.trade !== null;
      case 1: return inputs.quotesPerWeek >= 1;
      case 2: return inputs.minsPerQuote >= 1;
      case 3: return inputs.avgJobValue >= 1;
      default: return false;
    }
  };

  const handleNext = () => {
    if (!canAdvance()) return;

    if (step < 3) {
      setStep(step + 1);
      return;
    }

    // Step 3 → show results
    setResults(calculate(inputs));
    setStep(4);
  };

  const handleShare = async () => {
    if (!results) return;
    const text = `I just found out I waste ${fmtHours(results.weeklyHours)} a week on quotes — that's ${fmtDollars(results.annualRevenueLost)}/year in lost jobs. Check yours:`;
    if (navigator.share) {
      try {
        await navigator.share({ text, url: window.location.origin + "/tools/quote-calculator" });
      } catch { /* user cancelled */ }
    } else {
      await navigator.clipboard.writeText(`${text} ${window.location.origin}/tools/quote-calculator`);
    }
  };

  /* ---- Progress bar ---- */
  const progressPct = step <= 3 ? ((Math.min(step, 3)) / STEP_COUNT) * 100 : 100;

  /* ---- Results screen ---- */
  if (step === 4 && results) {
    return (
      <div className={`bg-white rounded-2xl shadow-lg p-6 md:p-8 ${className}`}>
        <h3 className="text-2xl font-bold text-text mb-6 text-center">Your Quoting Cost</h3>

        {/* Current state */}
        <div className="bg-red-50 border border-red-100 rounded-xl p-5 mb-4">
          <p className="text-sm font-semibold text-red-700 mb-3 uppercase tracking-wide">Right now</p>
          <div className="space-y-2 text-text">
            <div className="flex justify-between">
              <span className="flex items-center gap-2"><Clock className="w-4 h-4 text-red-500" /> Weekly quoting time</span>
              <span className="font-bold">{fmtHours(results.weeklyHours)}</span>
            </div>
            <div className="flex justify-between">
              <span className="flex items-center gap-2"><Clock className="w-4 h-4 text-red-500" /> Annual quoting time</span>
              <span className="font-bold">{fmtHours(results.annualHours)}</span>
            </div>
            <div className="flex justify-between">
              <span className="flex items-center gap-2"><DollarSign className="w-4 h-4 text-red-500" /> Revenue at risk (jobs lost to slow quotes)</span>
              <span className="font-bold text-red-600">{fmtDollars(results.annualRevenueLost)}/yr</span>
            </div>
          </div>
        </div>

        {/* With ChurQuote */}
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-5 mb-6">
          <p className="text-sm font-semibold text-emerald-700 mb-3 uppercase tracking-wide">With ChurQuote</p>
          <div className="space-y-2 text-text">
            <div className="flex justify-between">
              <span className="flex items-center gap-2"><Clock className="w-4 h-4 text-emerald-500" /> Weekly quoting time</span>
              <span className="font-bold">{results.churquoteWeeklyMins} min</span>
            </div>
            <div className="flex justify-between">
              <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Hours saved per year</span>
              <span className="font-bold text-emerald-600">{fmtHours(results.timeSavedAnnualHours)}</span>
            </div>
            <div className="flex justify-between">
              <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Evenings back with your family</span>
              <span className="font-bold text-emerald-600">{results.eveningsSaved} per year</span>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center space-y-4">
          <Button
            size="lg"
            className="w-full bg-cta hover:bg-primary-dark text-white text-base py-6 rounded-xl font-semibold shadow-lg shadow-indigo-200/50"
            onClick={() => window.location.href = "/dashboard"}
          >
            Try ChurQuote Free
          </Button>
          <button
            onClick={handleShare}
            className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-primary transition-colors"
          >
            <Share2 className="w-4 h-4" />
            Share your results
          </button>
        </div>
      </div>
    );
  }

  /* ---- Input steps ---- */
  return (
    <div className={`bg-white rounded-2xl shadow-lg p-6 md:p-8 ${className}`}>
      {/* Progress bar */}
      <div className="mb-6">
        <div className="flex justify-between text-xs text-text-muted mb-2">
          <span>{step < 4 ? `Step ${step + 1} of ${STEP_COUNT}` : "Almost there"}</span>
          <span>{Math.round(progressPct)}%</span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Step content */}
      <div className="min-h-[200px] flex flex-col justify-between">
        {step === 0 && (
          <div>
            <h3 className="text-lg font-bold text-text mb-1">What&apos;s your trade?</h3>
            <p className="text-sm text-text-muted mb-4">Select the closest match.</p>
            <div className="grid grid-cols-2 gap-3">
              {TRADES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setInputs({ ...inputs, trade: t.value })}
                  className={`p-4 rounded-xl border-2 text-sm font-medium transition-all ${
                    inputs.trade === t.value
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-slate-200 text-text hover:border-slate-300"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 1 && (
          <div>
            <h3 className="text-lg font-bold text-text mb-1">How many quotes do you send per week?</h3>
            <p className="text-sm text-text-muted mb-6">Rough estimate is fine.</p>
            <div className="space-y-4">
              <input
                type="range"
                min={1}
                max={20}
                value={inputs.quotesPerWeek}
                onChange={(e) => setInputs({ ...inputs, quotesPerWeek: Number(e.target.value) })}
                className="w-full h-3 bg-slate-200 rounded-full appearance-none cursor-pointer accent-primary"
              />
              <div className="text-center">
                <span className="text-4xl font-bold text-primary">{inputs.quotesPerWeek}</span>
                <span className="text-text-muted ml-2">quotes / week</span>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h3 className="text-lg font-bold text-text mb-1">How long does each quote take you?</h3>
            <p className="text-sm text-text-muted mb-6">From start to hitting send.</p>
            <div className="space-y-4">
              <input
                type="range"
                min={5}
                max={60}
                step={5}
                value={inputs.minsPerQuote}
                onChange={(e) => setInputs({ ...inputs, minsPerQuote: Number(e.target.value) })}
                className="w-full h-3 bg-slate-200 rounded-full appearance-none cursor-pointer accent-primary"
              />
              <div className="text-center">
                <span className="text-4xl font-bold text-primary">{inputs.minsPerQuote}</span>
                <span className="text-text-muted ml-2">minutes each</span>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h3 className="text-lg font-bold text-text mb-1">What&apos;s your average job value?</h3>
            <p className="text-sm text-text-muted mb-6">A rough average in NZD is fine.</p>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted font-medium">$</span>
              <Input
                type="number"
                inputMode="decimal"
                value={inputs.avgJobValue || ""}
                onChange={(e) => setInputs({ ...inputs, avgJobValue: Number(e.target.value) })}
                placeholder="1,500"
                className="h-14 text-2xl font-bold text-center pl-8 rounded-xl"
              />
            </div>
          </div>
        )}


        {/* Navigation */}
        <div className="flex justify-between items-center mt-6 pt-4 border-t border-slate-100">
          {step > 0 ? (
            <button
              onClick={() => setStep(step - 1)}
              className="flex items-center gap-1 text-sm text-text-muted hover:text-text transition-colors"
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
          ) : (
            <div />
          )}
          <Button
            onClick={handleNext}
            disabled={!canAdvance()}
            size="lg"
            className="bg-cta hover:bg-primary-dark text-white rounded-xl font-semibold px-8"
          >
            {step === 3 ? (
              "See My Results"
            ) : (
              <span className="flex items-center gap-2">Next <ArrowRight className="w-4 h-4" /></span>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
