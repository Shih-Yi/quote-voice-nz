"use client";

import Link from "next/link";
import { Mic, CheckCircle2, Send, SignalHigh, Receipt, Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-bg-white flex flex-col font-sans">
      <Header showLogin maxWidth="max-w-5xl" />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="px-4 py-12 md:py-24 lg:py-32 max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div className="flex flex-col gap-6 text-center md:text-left">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-text">
                Stop typing,<br />start quoting.<br />
                <span className="text-primary">Easy as.</span>
              </h1>
              <p className="text-lg md:text-xl text-text-muted max-w-lg mx-auto md:mx-0">
                Generate professional NZ quotes using just your voice. Built for the field, optimized for the trade.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start pt-4">
                <Link href="/dashboard">
                  <Button size="lg" className="w-full sm:w-auto bg-cta hover:bg-primary-dark text-white text-lg px-8 py-6 rounded-xl font-semibold shadow-lg shadow-indigo-200">
                    Try it Free - Beta Access
                  </Button>
                </Link>
              </div>
              <p className="text-sm text-text-muted/80">
                No credit card required. Works on any device.
              </p>
            </div>

            {/* Mobile App Mockup Visual */}
            <div className="relative mx-auto w-[280px] md:w-[320px] aspect-[9/19] bg-slate-900 rounded-[3rem] p-4 shadow-2xl ring-1 ring-slate-900/5 rotate-[-2deg] hover:rotate-0 transition-transform duration-500">
              {/* Screen Content */}
              <div className="h-full w-full bg-bg rounded-[2.2rem] overflow-hidden flex flex-col relative">
                {/* Status Bar */}
                <div className="h-6 w-full flex justify-between items-center px-6 pt-2">
                  <span className="text-[10px] font-bold text-text">9:41</span>
                  <div className="flex gap-1">
                    <div className="w-3 h-3 bg-text rounded-full opacity-20"></div>
                    <div className="w-3 h-3 bg-text rounded-full opacity-20"></div>
                  </div>
                </div>

                {/* App Header */}
                <div className="px-6 py-4 flex items-center gap-2">
                  <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white text-xs font-bold">KQ</div>
                  <span className="font-semibold text-text text-sm">New Quote</span>
                </div>

                {/* Voice Interaction Demo */}
                <div className="flex-1 flex flex-col items-center justify-center p-6 gap-6 bg-white rounded-t-[2rem] shadow-sm">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary animate-pulse">
                    <Mic className="w-8 h-8" />
                  </div>
                  <div className="space-y-3 w-full">
                    <div className="h-2 w-3/4 bg-slate-100 rounded-full mx-auto"></div>
                    <div className="h-2 w-1/2 bg-slate-100 rounded-full mx-auto"></div>
                    <div className="h-2 w-5/6 bg-slate-100 rounded-full mx-auto"></div>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-xl w-full border border-slate-100 mt-2">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-medium text-text-muted">Extracted Item</span>
                      <span className="text-xs font-bold text-primary">$150.00</span>
                    </div>
                    <p className="text-sm font-medium text-text">Replace kitchen mixer tap</p>
                  </div>
                </div>

                {/* Bottom Action */}
                <div className="p-6 bg-white pb-8">
                  <div className="w-full bg-primary text-white py-3 rounded-lg text-center text-sm font-semibold">
                    Generate Quote
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* The Problem Section */}
        <section className="bg-bg py-20 px-4">
          <div className="max-w-3xl mx-auto text-center space-y-8">
            <h2 className="text-3xl font-bold text-text">Dreading the late-night admin?</h2>
            <p className="text-xl text-text-muted leading-relaxed">
              You've done the hard yakka on site. The last thing you want is to spend hours typing up quotes when you could be relaxing with a cold one.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-8">
              <Card className="bg-white border-none shadow-sm">
                <CardContent className="pt-6">
                  <div className="text-4xl mb-4">😫</div>
                  <h3 className="font-semibold mb-2">Lost Details</h3>
                  <p className="text-sm text-text-muted">Forget measurements written on scrap wood?</p>
                </CardContent>
              </Card>
              <Card className="bg-white border-none shadow-sm">
                <CardContent className="pt-6">
                  <div className="text-4xl mb-4">⏳</div>
                  <h3 className="font-semibold mb-2">Hours Wasted</h3>
                  <p className="text-sm text-text-muted">Typing with one finger on a phone screen?</p>
                </CardContent>
              </Card>
              <Card className="bg-white border-none shadow-sm">
                <CardContent className="pt-6">
                  <div className="text-4xl mb-4">💸</div>
                  <h3 className="font-semibold mb-2">Slow Quotes</h3>
                  <p className="text-sm text-text-muted">Late quotes lose jobs to the other guys.</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section className="py-24 px-4 max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-text">3 Simple Steps</h2>
            <p className="text-text-muted mt-4">From site visit to sent quote in under 2 minutes.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative">
            {/* Connecting Line (Desktop) */}
            <div className="hidden md:block absolute top-12 left-[16%] right-[16%] h-0.5 bg-slate-100 -z-10"></div>

            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-24 h-24 bg-primary/5 rounded-full flex items-center justify-center border-4 border-white shadow-sm z-10">
                <Mic className="w-10 h-10 text-primary" />
              </div>
              <h3 className="text-xl font-bold">1. Speak</h3>
              <p className="text-text-muted">Walk the site and just talk. Describe the job, materials, and costs naturally.</p>
            </div>

            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-24 h-24 bg-primary/5 rounded-full flex items-center justify-center border-4 border-white shadow-sm z-10">
                <CheckCircle2 className="w-10 h-10 text-primary" />
              </div>
              <h3 className="text-xl font-bold">2. Review</h3>
              <p className="text-text-muted">AI instantly converts your voice into a structured quote with itemized costs.</p>
            </div>

            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-24 h-24 bg-primary/5 rounded-full flex items-center justify-center border-4 border-white shadow-sm z-10">
                <Send className="w-10 h-10 text-primary" />
              </div>
              <h3 className="text-xl font-bold">3. Send</h3>
              <p className="text-text-muted">Share a professional PDF link with your customer via SMS or Email.</p>
            </div>
          </div>
        </section>

        {/* NZ Features Section */}
        <section className="bg-slate-900 text-white py-24 px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold">Built for NZ Tradies 🥝</h2>
              <p className="text-slate-400 mt-4">We speak your language and know how you work.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <Card className="bg-slate-800 border-slate-700 text-slate-100">
                <CardContent className="pt-6 flex flex-col items-start gap-4">
                  <div className="p-3 bg-primary/20 rounded-lg">
                    <Receipt className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg mb-2">GST Sorted</h3>
                    <p className="text-sm text-slate-400">Built-in 15% GST handling. Quotes show clear ex-GST and incl-GST totals automatically.</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-slate-800 border-slate-700 text-slate-100">
                <CardContent className="pt-6 flex flex-col items-start gap-4">
                  <div className="p-3 bg-primary/20 rounded-lg">
                    <Languages className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg mb-2">Kiwi Slang Ready</h3>
                    <p className="text-sm text-slate-400">Our AI understands "hundy", "grand", "sweet as", and "mate". No need to talk like a robot.</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-slate-800 border-slate-700 text-slate-100">
                <CardContent className="pt-6 flex flex-col items-start gap-4">
                  <div className="p-3 bg-primary/20 rounded-lg">
                    <SignalHigh className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg mb-2">Offline First</h3>
                    <p className="text-sm text-slate-400">No signal in the wop-wops? No worries. Record now, sync when you're back in range.</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* FAQ / Final CTA */}
        <section className="py-24 px-4 max-w-3xl mx-auto text-center space-y-8">
          <h2 className="text-3xl font-bold text-text">Ready to save hours every week?</h2>
          <p className="text-text-muted">Join the beta today and get your evenings back.</p>
          <Link href="/dashboard">
            <Button size="lg" className="bg-cta hover:bg-primary-dark text-white text-lg px-12 py-6 rounded-xl font-semibold shadow-xl shadow-indigo-100">
              Get Started for Free
            </Button>
          </Link>
          <p className="text-sm text-text-muted">
            Questions? Email us at <a href="mailto:support@kiwispeakquote.co.nz" className="text-primary hover:underline">support@kiwispeakquote.co.nz</a>
          </p>
        </section>
      </main>

      <Footer />
    </div>
  );
}