"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, Loader2 } from "lucide-react";

interface WaitlistFormProps {
  buttonText?: string;
  showTrade?: boolean;
  className?: string;
  variant?: "default" | "dark";
}

export function WaitlistForm({
  buttonText = "Get Early Access \u2014 Free",
  showTrade = false,
  className = "",
  variant = "default",
}: WaitlistFormProps) {
  const [email, setEmail] = useState("");
  const [trade, setTrade] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setStatus("loading");
    setErrorMessage("");

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), trade: trade.trim() || undefined }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Something went wrong");
      }

      setStatus("success");
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Something went wrong on our end. Try again?");
    }
  };

  if (status === "success") {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <div className={`flex items-center gap-2 px-4 py-3 rounded-xl ${
          variant === "dark"
            ? "bg-emerald-500/20 text-emerald-300"
            : "bg-emerald-50 text-emerald-700"
        }`}>
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span className="text-sm font-medium">
            You&apos;re on the list. We&apos;ll email you when it&apos;s your turn.
          </span>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={`flex flex-col gap-3 ${className}`}>
      <div className="flex flex-col sm:flex-row gap-3">
        <Input
          type="email"
          placeholder="Your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className={`h-12 text-base rounded-xl px-4 ${
            variant === "dark"
              ? "bg-white/10 border-white/20 text-white placeholder:text-white/50"
              : "bg-white border-border"
          }`}
        />
        {showTrade && (
          <Input
            type="text"
            placeholder="What's your trade?"
            value={trade}
            onChange={(e) => setTrade(e.target.value)}
            className={`h-12 text-base rounded-xl px-4 ${
              variant === "dark"
                ? "bg-white/10 border-white/20 text-white placeholder:text-white/50"
                : "bg-white border-border"
            }`}
          />
        )}
        <Button
          type="submit"
          disabled={status === "loading"}
          size="lg"
          className="h-12 bg-cta hover:bg-primary-dark text-white text-base px-8 rounded-xl font-semibold shadow-lg shadow-indigo-200/50 whitespace-nowrap shrink-0"
        >
          {status === "loading" ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            buttonText
          )}
        </Button>
      </div>
      {status === "error" && (
        <p className="text-sm text-red-500">{errorMessage}</p>
      )}
    </form>
  );
}
