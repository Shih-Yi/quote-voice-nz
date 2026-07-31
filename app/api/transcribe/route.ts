import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";
import { rateLimit } from "@/lib/rateLimit";
import { captureError } from "@/lib/sentry";
import { getCurrentUserServer } from "@/lib/supabase/auth-server";
import {
  checkGlobalTranscribeCap,
  checkAnonDeviceQuota,
  checkAnonIpQuota,
  consumeUserDailyQuota,
  peekUserDailyQuota,
  LIMITS,
} from "@/lib/costGuard";

function getClientIp(request: NextRequest): string {
  return (
    request.headers?.get?.("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers?.get?.("x-real-ip") ||
    "unknown"
  );
}

export async function POST(request: NextRequest) {
  // Burst protection — unchanged. Daily caps layered on top below.
  const rateLimited = await rateLimit(request, { limit: 10, windowSeconds: 60 });
  if (rateLimited) return rateLimited;

  const ip = getClientIp(request);
  const deviceToken = request.headers?.get?.("x-device-token") ?? null;

  try {
    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    // Identify the caller first so the global cap can charge the right pool.
    // Anonymous callers cost nothing extra here — no tier lookup is needed
    // for them, so a flood still short-circuits after one cheap session read.
    const user = await getCurrentUserServer();
    const { getMonthlyUsage, getUserTier, TIER_LIMITS } = await import(
      "@/lib/supabase/subscription"
    );
    const tier = user ? await getUserTier(user.id) : "free";
    const isPaid = tier !== "free";

    // Rule 1 — global daily cap, split into free and paid pools. A single
    // shared counter meant anonymous traffic could exhaust the day's
    // allowance and lock paying customers out until UTC midnight.
    const globalGuard = await checkGlobalTranscribeCap(isPaid);
    if (!globalGuard.allowed) {
      return NextResponse.json(
        {
          error: "daily_capacity_reached",
          message: "Service is at capacity for today. Please try again tomorrow.",
        },
        { status: 503, headers: { "Retry-After": String(globalGuard.retryAfter) } }
      );
    }

    // Anonymous users: layered daily quotas (Rules 2 + 3).
    if (!user) {
      if (!deviceToken) {
        return NextResponse.json(
          { error: "device_token_required" },
          { status: 400 }
        );
      }

      const deviceGuard = await checkAnonDeviceQuota(deviceToken);
      if (!deviceGuard.allowed) {
        return NextResponse.json(
          {
            error: "anon_quota_exceeded",
            action: "login_required",
            message: `Free trial limit reached (${LIMITS.ANON_DEVICE_DAILY}/day). Please log in to continue.`,
            limit: LIMITS.ANON_DEVICE_DAILY,
          },
          { status: 429, headers: { "Retry-After": String(deviceGuard.retryAfter) } }
        );
      }

      const ipGuard = await checkAnonIpQuota(ip);
      if (!ipGuard.allowed) {
        return NextResponse.json(
          {
            error: "anon_quota_exceeded",
            action: "login_required",
            message: `Daily limit reached from this network (${LIMITS.ANON_IP_DAILY}/day). Please log in to continue.`,
            limit: LIMITS.ANON_IP_DAILY,
          },
          { status: 429, headers: { "Retry-After": String(ipGuard.retryAfter) } }
        );
      }
    }

    const formData = await request.formData();
    const audioFile = formData.get("audio") as File;

    if (!audioFile) {
      return NextResponse.json(
        { error: "No audio file provided" },
        { status: 400 }
      );
    }

    if (audioFile.size > 25 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Audio file too large. Maximum size is 25MB." },
        { status: 400 }
      );
    }

    // Tier-based quota for logged-in users. Checked here so an over-quota
    // request is rejected before we spend anything on Groq; the daily counter
    // is incremented further down, only once the transcription has actually
    // come back. Consuming it here instead meant a network failure or a Groq
    // timeout burned a slot, and the offline retry queue re-burned one on
    // every attempt — the exact situation this app is built for.
    let dailyQuotaLimit: number | null = null;
    if (user) {
      const limits = TIER_LIMITS[tier];
      const limit = limits.quotesPerMonth;
      const usage = await getMonthlyUsage(user.id);
      if (usage.quotesCreated >= limit) {
        return NextResponse.json(
          {
            error: "quota_exceeded",
            limit,
            used: usage.quotesCreated,
            tier,
          },
          { status: 429 }
        );
      }

      // Daily cap layered under monthly — free tier can't dump its full month
      // allowance in one day. Peek only; the increment happens after Groq
      // returns. /api/extract also peeks, and relies on this route owning the
      // increment so the paired voice flow counts once.
      dailyQuotaLimit = limits.quotesPerDay;
      const dailyGuard = await peekUserDailyQuota(user.id, limits.quotesPerDay);
      if (!dailyGuard.allowed) {
        return NextResponse.json(
          {
            error: "daily_quota_exceeded",
            limit: limits.quotesPerDay,
            tier,
          },
          {
            status: 429,
            headers: { "Retry-After": String(dailyGuard.retryAfter) },
          }
        );
      }
    }

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const transcription = await groq.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-large-v3",
      language: "en",
      response_format: "json",
      prompt:
        "Use New Zealand English spelling: labour, colour, centre, metre, organised, specialised. This is a quote for trade work in New Zealand.",
    });

    // Transcription succeeded, so now the daily slot is genuinely used.
    // A failure above returns before this point and costs the user nothing.
    if (user && dailyQuotaLimit !== null) {
      const consumed = await consumeUserDailyQuota(user.id, dailyQuotaLimit);
      if (!consumed.allowed) {
        // A concurrent request took the last slot between our peek and here.
        // The Groq call is already paid for — hand the text over and log it
        // rather than throw away work the user is entitled to.
        console.warn(
          `[/api/transcribe] DAILY_QUOTA_RACE user=${user.id} — served past limit ${dailyQuotaLimit}`
        );
      }
    }

    // NOTE: the monthly quotes_created counter is deliberately NOT incremented
    // here. /api/quotes owns it, incrementing once per new quote row, so that
    // manually-typed quotes count against the plan too — they never touch this
    // route. Counting in both places would double-charge the voice flow.
    // Groq spend stays bounded by the global cap, the anon device/IP caps and
    // the per-user daily quota consumed above.

    return NextResponse.json({ text: transcription.text });
  } catch (error) {
    console.error("Transcription error:", error);
    captureError(error, { route: "/api/transcribe" });

    if (error instanceof Error) {
      if (error.message.includes("rate limit")) {
        return NextResponse.json(
          { error: "Too many requests. Please try again." },
          { status: 429 }
        );
      }

      if (
        error.message.includes("Invalid API Key") ||
        error.message.includes("401")
      ) {
        // Our misconfiguration, not the caller's. The old message named the
        // provider and the exact env var to anyone who could trigger it.
        return NextResponse.json(
          { error: "Service temporarily unavailable" },
          { status: 503 }
        );
      }

      // Provider errors can include request ids and model details — logged
      // above and sent to Sentry, but not returned.
      return NextResponse.json(
        { error: "Failed to transcribe audio" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: "Failed to transcribe audio" },
      { status: 500 }
    );
  }
}
