import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";
import { rateLimit } from "@/lib/rateLimit";
import { captureError } from "@/lib/sentry";
import { getCurrentUserServer } from "@/lib/supabase/auth-server";
import { checkAndIncrementUsage } from "@/lib/supabase/subscription";
import {
  checkGlobalTranscribeCap,
  checkAnonDeviceQuota,
  checkAnonIpQuota,
  consumeUserDailyQuota,
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

    // Rule 1 — global daily cap. Checked first so a flood doesn't waste DB
    // round-trips on per-user quota lookups.
    const globalGuard = await checkGlobalTranscribeCap();
    if (!globalGuard.allowed) {
      return NextResponse.json(
        {
          error: "daily_capacity_reached",
          message: "Service is at capacity for today. Please try again tomorrow.",
        },
        { status: 503, headers: { "Retry-After": String(globalGuard.retryAfter) } }
      );
    }

    const user = await getCurrentUserServer();

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

    // Tier-based quota for logged-in users — check BEFORE Groq call so we
    // reject early, but increment only after success to avoid wasting quota
    // on a failed API call.
    if (user) {
      const { getMonthlyUsage, getUserTier, TIER_LIMITS } = await import(
        "@/lib/supabase/subscription"
      );
      const tier = await getUserTier(user.id);
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

      // Daily cap layered under monthly — free tier can't dump full month
      // allowance in one day. Consumes (increments) here so the gate is
      // self-contained; /api/extract peeks without consuming to avoid double
      // counting the paired voice flow.
      const dailyGuard = await consumeUserDailyQuota(
        user.id,
        limits.quotesPerDay
      );
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

    if (user) {
      const quotaResult = await checkAndIncrementUsage(user.id, "quotes_created");
      if (!quotaResult.allowed) {
        // Edge case: another request consumed the final quota between our
        // pre-check and here. Groq already ran — return the transcript rather
        // than waste the work.
      }
    }

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
        return NextResponse.json(
          { error: "Invalid API key. Please check your GROQ_API_KEY." },
          { status: 401 }
        );
      }

      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { error: "Failed to transcribe audio" },
      { status: 500 }
    );
  }
}
