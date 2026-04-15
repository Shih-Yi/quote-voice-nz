"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import {
  Mic,
  CheckCircle2,
  Send,
  SignalHigh,
  Receipt,
  Languages,
  Clock,
  Trophy,
  ShoppingCart,
  MessageSquare,
  RefreshCw,
  ChevronDown,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { AuthModal } from "@/components/auth/AuthModal";
import { useAuth } from "@/hooks/useAuth";
import { WaitlistForm } from "@/components/landing/WaitlistForm";

const FAQ_ITEMS = [
  {
    q: "I\u2019m not tech savvy. Is this complicated?",
    a: "If you can send a voice message on your phone, you can use ChurQuote. One button. Speak. Done. No training sessions, no user manuals, no 45-minute onboarding calls.",
  },
  {
    q: "What if AI gets the quote wrong?",
    a: "You always review before sending. ChurQuote does the draft \u2014 you do the final check. One tap to edit, one tap to send. You\u2019re always in control.",
  },
  {
    q: "I work in areas with no mobile signal.",
    a: "That\u2019s exactly why we built offline mode. Record your quote with zero bars. ChurQuote stores it on your phone and syncs when you\u2019re back in range. Not a single quote lost.",
  },
  {
    q: "How much does it cost?",
    a: "We\u2019re still finalising pricing, but it won\u2019t be $50/month per person \u2014 we can promise you that. Join the waitlist for founding member pricing when we launch.",
  },
  {
    q: "I already use Tradify / Fergus. Why switch?",
    a: "You don\u2019t have to. ChurQuote isn\u2019t trying to replace your job management system. It\u2019s the fastest way to get a quote out the door. Use it alongside what you\u2019ve got, or on its own. Your call.",
  },
];

function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  return (
    <div className="space-y-3">
      {FAQ_ITEMS.map((item, i) => (
        <div key={i} className="bg-white rounded-xl shadow-sm overflow-hidden">
          <button
            onClick={() => setOpenIndex(openIndex === i ? null : i)}
            className="w-full flex items-center justify-between gap-4 p-5 text-left hover:bg-slate-50 transition-colors"
          >
            <span className="font-semibold text-text">&ldquo;{item.q}&rdquo;</span>
            <ChevronDown className={`w-5 h-5 text-text-muted shrink-0 transition-transform ${openIndex === i ? "rotate-180" : ""}`} />
          </button>
          {openIndex === i && (
            <div className="px-5 pb-5 text-text-muted leading-relaxed">
              {item.a}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function LandingPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading, signUp, signIn, signInGoogle } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [defaultTab, setDefaultTab] = useState<"login" | "register">("login");

  useEffect(() => {
    if (loading) return; // wait for auth state to resolve
    if (user) return;    // already logged in — don't open modal
    const authParam = searchParams.get("auth");
    if (authParam === "register") {
      setDefaultTab("register");
      setShowAuthModal(true);
    } else if (authParam === "login") {
      setDefaultTab("login");
      setShowAuthModal(true);
    }
  }, [searchParams, user, loading]);

  // Clean URL when modal closes
  const handleOpenChange = (open: boolean) => {
    setShowAuthModal(open);
    if (!open) {
      router.replace("/", { scroll: false });
    }
  };

  return (
    <div className="min-h-screen bg-bg-white flex flex-col font-sans">
      <Header maxWidth="max-w-5xl" />

      <main className="flex-1">
        {/* Auth Modal for Deep Linking */}
        <AuthModal
            open={showAuthModal}
            onOpenChange={handleOpenChange}
            defaultTab={defaultTab}
            onSignUp={signUp}
            onSignIn={signIn}
            onSignInGoogle={signInGoogle}
        />

        {/* Hero Section */}
        <section className="px-4 py-16 md:py-28 lg:py-36 max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div className="flex flex-col gap-6 text-center md:text-left">
              <h1 className="text-4xl md:text-5xl lg:text-[3.5rem] font-bold tracking-tight text-text leading-[1.1]">
                Send a Professional Quote in 60 Seconds.{" "}
                <span className="text-primary">From Your Ute.</span>
              </h1>
              <p className="text-lg md:text-xl text-text-muted max-w-lg mx-auto md:mx-0 leading-relaxed">
                ChurQuote turns your voice into a professional, GST-calculated quote — before you&apos;ve even left the job site. No typing. No laptop. No signal needed.
              </p>
              <div className="pt-2 max-w-md mx-auto md:mx-0 w-full">
                <WaitlistForm />
              </div>
              <p className="text-sm text-text-muted/80">
                No credit card. No commitment. Built in Aotearoa, for Kiwi tradies.
              </p>
            </div>

            {/* Mobile App Mockup Visual */}
            <div className="relative mx-auto w-[280px] md:w-[320px] aspect-[9/19] bg-slate-900 rounded-[3rem] p-4 shadow-2xl ring-1 ring-slate-900/5 rotate-[-2deg] hover:rotate-0 transition-transform duration-500">
              <div className="h-full w-full bg-bg rounded-[2.2rem] overflow-hidden flex flex-col relative">
                <div className="h-6 w-full flex justify-between items-center px-6 pt-2">
                  <span className="text-[10px] font-bold text-text">9:41</span>
                  <div className="flex gap-1">
                    <div className="w-3 h-3 bg-text rounded-full opacity-20"></div>
                    <div className="w-3 h-3 bg-text rounded-full opacity-20"></div>
                  </div>
                </div>
                <div className="px-6 py-4 flex items-center gap-2">
                  <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white text-xs font-bold">CQ</div>
                  <span className="font-semibold text-text text-sm">New Quote</span>
                </div>
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
                      <span className="text-xs font-bold text-primary">$1,100.00</span>
                    </div>
                    <p className="text-sm font-medium text-text">Rheem 135L HWC</p>
                    <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-100">
                      <span className="text-xs text-text-muted">4hrs labour @ $85</span>
                      <span className="text-xs font-bold text-text">$340.00</span>
                    </div>
                  </div>
                </div>
                <div className="p-6 bg-white pb-8">
                  <div className="w-full bg-secondary text-white py-3 rounded-lg text-center text-sm font-semibold">
                    Send Quote to Client
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Problem Section — The Agitation */}
        <section className="bg-bg py-20 md:py-28 px-4">
          <div className="max-w-3xl mx-auto space-y-8">
            <h2 className="text-3xl md:text-4xl font-bold text-text text-center">Sound familiar?</h2>
            <div className="text-lg text-text-muted leading-relaxed space-y-5">
              <p>
                You&apos;ve done a full day on the tools. Knackered. Covered in dust. And now you&apos;ve got three quotes to write up before tomorrow.
              </p>
              <p>
                So you sit down at the kitchen table after dinner. Open the laptop. Start typing up materials, labour hours, GST calculations — line by bloody line.
              </p>
              <p>
                By the time you&apos;re done, the kids are in bed. The missus has given up waiting. And that quote for the Henderson job? The customer already went with someone who got back to them faster.
              </p>
            </div>
            <p className="text-xl font-semibold text-text text-center">
              You didn&apos;t lose the job because your price was wrong. You lost it because you were too slow.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-4">
              <Card className="bg-white border-none shadow-sm">
                <CardContent className="pt-6 text-center">
                  <Clock className="w-8 h-8 text-primary mx-auto mb-3" />
                  <h3 className="font-semibold mb-1">Hours Wasted</h3>
                  <p className="text-sm text-text-muted">Evenings spent typing quotes instead of living</p>
                </CardContent>
              </Card>
              <Card className="bg-white border-none shadow-sm">
                <CardContent className="pt-6 text-center">
                  <Trophy className="w-8 h-8 text-primary mx-auto mb-3" />
                  <h3 className="font-semibold mb-1">Jobs Lost</h3>
                  <p className="text-sm text-text-muted">Faster quoters win the work. Simple as.</p>
                </CardContent>
              </Card>
              <Card className="bg-white border-none shadow-sm">
                <CardContent className="pt-6 text-center">
                  <MessageSquare className="w-8 h-8 text-primary mx-auto mb-3" />
                  <h3 className="font-semibold mb-1">Wrong Tools</h3>
                  <p className="text-sm text-text-muted">Built for desk jockeys, not tradies on site</p>
                </CardContent>
              </Card>
            </div>
            <p className="text-center text-lg font-medium text-primary pt-4">
              There&apos;s a better way.
            </p>
          </div>
        </section>

        {/* How It Works — The Mechanism */}
        <section className="py-24 md:py-28 px-4 max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-text">How ChurQuote Works</h2>
            <p className="text-lg text-text-muted mt-4">Three steps. Sixty seconds. Done.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative">
            <div className="hidden md:block absolute top-12 left-[16%] right-[16%] h-0.5 bg-slate-200 -z-10"></div>

            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-24 h-24 bg-primary/5 rounded-full flex items-center justify-center border-4 border-white shadow-md z-10">
                <Mic className="w-10 h-10 text-primary" />
              </div>
              <h3 className="text-xl font-bold">1. Tap & Speak</h3>
              <p className="text-text-muted leading-relaxed">
                One button. Talk like you&apos;d talk to your mate: &ldquo;Hot water cylinder replacement for Mrs Collins, 32 Riccarton Road. Cylinder&apos;s a grand, labour&apos;s about four hours at eighty bucks.&rdquo;
              </p>
            </div>

            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-24 h-24 bg-primary/5 rounded-full flex items-center justify-center border-4 border-white shadow-md z-10">
                <CheckCircle2 className="w-10 h-10 text-primary" />
              </div>
              <h3 className="text-xl font-bold">2. AI Does the Maths</h3>
              <p className="text-text-muted leading-relaxed">
                ChurQuote understands Kiwi — the slang, the accent, the lot. It calculates 15% GST and formats everything into a clean, professional quote with your business name and logo.
              </p>
            </div>

            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-24 h-24 bg-primary/5 rounded-full flex items-center justify-center border-4 border-white shadow-md z-10">
                <Send className="w-10 h-10 text-primary" />
              </div>
              <h3 className="text-xl font-bold">3. Confirm & Send</h3>
              <p className="text-text-muted leading-relaxed">
                Review it on your phone. One tap to send. Your client gets a proper quote link before you&apos;ve started the ute.
              </p>
            </div>
          </div>

          <div className="mt-12 text-center">
            <div className="inline-flex items-center gap-2 bg-secondary/10 text-secondary px-5 py-3 rounded-full text-sm font-medium">
              <SignalHigh className="w-4 h-4" />
              Works with zero signal too. Saves offline, syncs when you&apos;re back in range.
            </div>
          </div>
        </section>

        {/* Benefits Section */}
        <section className="bg-bg py-20 md:py-28 px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-text text-center mb-14">
              Why Tradies Are Switching to ChurQuote
            </h2>
            <div className="space-y-8">
              {[
                {
                  icon: <Clock className="w-6 h-6" />,
                  title: "Quote from the job site, not the kitchen table",
                  desc: "Finish the job, speak your quote, send it before you drive away. Your evenings belong to you again.",
                },
                {
                  icon: <Trophy className="w-6 h-6" />,
                  title: "First to quote wins the job",
                  desc: "While other tradies are \"getting back to them tomorrow,\" your quote's already in the client's inbox. Speed wins work. Simple as.",
                },
                {
                  icon: <ShoppingCart className="w-6 h-6" />,
                  title: "Placemakers & Mitre 10 prices, built in",
                  desc: "No more guessing material costs or looking up price lists. ChurQuote pulls current pricing so your quotes are accurate from the start.",
                },
                {
                  icon: <Languages className="w-6 h-6" />,
                  title: "Speaks fluent Kiwi",
                  desc: "\"Two grand for the cylinder.\" \"About four hours' labour.\" \"Chuck in the call-out fee.\" ChurQuote gets it — the slang, the accent, all of it. GST calculated at 15%, every time.",
                },
                {
                  icon: <RefreshCw className="w-6 h-6" />,
                  title: "Syncs straight to Xero",
                  desc: "Quote approved? It flows into your Xero account automatically. No double-handling. No re-typing. No \"I'll do the invoice later.\"",
                },
              ].map((benefit) => (
                <div key={benefit.title} className="flex gap-5 items-start bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
                  <div className="p-3 bg-primary/10 rounded-lg text-primary shrink-0">
                    {benefit.icon}
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-text mb-1">{benefit.title}</h3>
                    <p className="text-text-muted leading-relaxed">{benefit.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* NZ Features — Dark Band */}
        <section className="bg-slate-900 text-white py-20 md:py-24 px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-14">
              <h2 className="text-3xl md:text-4xl font-bold">Built for NZ. By Kiwis.</h2>
              <p className="text-slate-400 mt-4">Every feature exists because a real tradie told us they needed it.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <Card className="bg-slate-800 border-slate-700 text-slate-100">
                <CardContent className="pt-6 flex flex-col items-start gap-4">
                  <div className="p-3 bg-primary/20 rounded-lg">
                    <Receipt className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg mb-2">GST Sorted</h3>
                    <p className="text-sm text-slate-400">15% GST calculated automatically. Clear ex-GST and incl-GST totals on every quote.</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-slate-800 border-slate-700 text-slate-100">
                <CardContent className="pt-6 flex flex-col items-start gap-4">
                  <div className="p-3 bg-primary/20 rounded-lg">
                    <Languages className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg mb-2">Kiwi Voice Recognition</h3>
                    <p className="text-sm text-slate-400">&ldquo;Hundy&rdquo;, &ldquo;grand&rdquo;, &ldquo;sweet as&rdquo; — our AI speaks your language. No need to talk like a robot.</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-slate-800 border-slate-700 text-slate-100">
                <CardContent className="pt-6 flex flex-col items-start gap-4">
                  <div className="p-3 bg-primary/20 rounded-lg">
                    <SignalHigh className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg mb-2">Zero-Bar Quoting</h3>
                    <p className="text-sm text-slate-400">Canterbury, West Coast, rural Waikato — wherever you are. Saves offline, syncs when you&apos;re back in range.</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Social Proof Section */}
        <section className="py-20 md:py-24 px-4">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <h2 className="text-3xl md:text-4xl font-bold text-text">Built by Kiwis Who Get It</h2>
            <div className="text-lg text-text-muted leading-relaxed space-y-4">
              <p>
                We didn&apos;t build ChurQuote in Silicon Valley and bolt on an NZ option. We built it here, in New Zealand, because we watched tradies spend their evenings doing admin instead of being with their families.
              </p>
              <p>
                Every feature — from the Kiwi voice recognition to the GST calculations to the offline mode — exists because a real tradie told us they needed it.
              </p>
            </div>
            <div className="inline-flex items-center gap-2 bg-primary/5 text-primary px-5 py-3 rounded-full text-sm font-medium">
              ChurQuote is currently in early access. Join the waitlist below to get in.
            </div>
          </div>
        </section>

        {/* Objection Handling / FAQ */}
        <section className="bg-bg py-20 md:py-24 px-4">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-text text-center mb-12">Questions? Fair enough.</h2>
            <FAQSection />
          </div>
        </section>

        {/* Final CTA Section */}
        <section className="py-24 md:py-32 px-4">
          <div className="max-w-2xl mx-auto text-center space-y-8">
            <h2 className="text-3xl md:text-4xl font-bold text-text">Stop Losing Jobs to Slow Quotes.</h2>
            <p className="text-lg text-text-muted leading-relaxed">
              ChurQuote is launching soon for NZ tradies. Early access members get:
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4 text-left sm:text-center">
              <div className="flex items-center gap-2 text-text">
                <CheckCircle2 className="w-5 h-5 text-secondary shrink-0" />
                <span className="text-sm font-medium">First in — use it before your competition</span>
              </div>
              <div className="flex items-center gap-2 text-text">
                <CheckCircle2 className="w-5 h-5 text-secondary shrink-0" />
                <span className="text-sm font-medium">Founding member pricing — locked in</span>
              </div>
              <div className="flex items-center gap-2 text-text">
                <CheckCircle2 className="w-5 h-5 text-secondary shrink-0" />
                <span className="text-sm font-medium">Direct input on features</span>
              </div>
            </div>
            <div className="pt-4 max-w-md mx-auto w-full">
              <WaitlistForm buttonText="Join the Waitlist \u2014 It\u2019s Free" showTrade />
            </div>
            <p className="text-sm text-text-muted">
              No credit card. No commitment. Just your email.
            </p>
            <p className="text-xs text-text-muted/70 pt-2">
              NZ-owned. NZ-built. For tradies, not desk jockeys.
            </p>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

export default function LandingPage() {
  return (
    <Suspense fallback={null}>
      <LandingPageContent />
    </Suspense>
  );
}