import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";
import { rateLimit } from "@/lib/rateLimit";
import { captureError } from "@/lib/sentry";
import { getCurrentUserServer } from "@/lib/supabase/auth-server";
import { checkAndIncrementUsage } from "@/lib/supabase/subscription";

export async function POST(request: NextRequest) {
  // Rate limit: 10 transcriptions per minute per IP
  const rateLimited = rateLimit(request, { limit: 10, windowSeconds: 60 });
  if (rateLimited) return rateLimited;

  try {
    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    const groq = new Groq({
      apiKey: process.env.GROQ_API_KEY,
    });

    const formData = await request.formData();
    const audioFile = formData.get("audio") as File;

    if (!audioFile) {
      return NextResponse.json(
        { error: "No audio file provided" },
        { status: 400 }
      );
    }

    // Check file size (max 25MB for Whisper)
    if (audioFile.size > 25 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Audio file too large. Maximum size is 25MB." },
        { status: 400 }
      );
    }

    // Quota check for logged-in users — BEFORE the API call to reject early,
    // but only increment AFTER success (see below)
    const user = await getCurrentUserServer();
    if (user) {
      const { getMonthlyUsage, getUserTier, TIER_LIMITS } = await import("@/lib/supabase/subscription");
      const tier = await getUserTier(user.id);
      const limits = TIER_LIMITS[tier];
      const limit = limits.quotesPerMonth;
      if (limit < 99999) {
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
      }
    }

    const transcription = await groq.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-large-v3",
      language: "en",
      response_format: "json",
      prompt: "Use New Zealand English spelling: labour, colour, centre, metre, organised, specialised. This is a quote for trade work in New Zealand.",
    });

    // Increment quota AFTER successful transcription — avoids wasting quota on API failure
    if (user) {
      const quotaResult = await checkAndIncrementUsage(user.id, "quotes_created");
      if (!quotaResult.allowed) {
        // Edge case: another request used the last quota between our check and here.
        // Still return the transcription since Groq already processed it.
      }
    }

    return NextResponse.json({
      text: transcription.text,
    });
  } catch (error) {
    console.error("Transcription error:", error);
    captureError(error, { route: "/api/transcribe" });

    if (error instanceof Error) {
      console.error("Error message:", error.message);

      if (error.message.includes("rate limit")) {
        return NextResponse.json(
          { error: "Too many requests. Please try again." },
          { status: 429 }
        );
      }

      if (error.message.includes("Invalid API Key") || error.message.includes("401")) {
        return NextResponse.json(
          { error: "Invalid API key. Please check your GROQ_API_KEY." },
          { status: 401 }
        );
      }

      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: "Failed to transcribe audio" },
      { status: 500 }
    );
  }
}
