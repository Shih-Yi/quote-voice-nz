import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";
import { rateLimit } from "@/lib/rateLimit";
import { captureError } from "@/lib/sentry";
import { getCurrentUser } from "@/lib/supabase/auth";
import { checkAndIncrementUsage } from "@/lib/supabase/subscription";

export async function POST(request: NextRequest) {
  // Rate limit: 10 transcriptions per minute per IP
  const rateLimited = rateLimit(request, { limit: 10, windowSeconds: 60 });
  if (rateLimited) return rateLimited;

  // Quota check for logged-in users
  const user = await getCurrentUser();
  if (user) {
    const quotaCheck = await checkAndIncrementUsage(user.id, "quotes_created");
    if (!quotaCheck.allowed) {
      return NextResponse.json(
        {
          error: "quota_exceeded",
          limit: quotaCheck.limit,
          used: quotaCheck.used,
          tier: "free",
        },
        { status: 429 }
      );
    }
  }

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

    const transcription = await groq.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-large-v3",
      language: "en",
      response_format: "json",
      prompt: "Use New Zealand English spelling: labour, colour, centre, metre, organised, specialised. This is a quote for trade work in New Zealand.",
    });

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
