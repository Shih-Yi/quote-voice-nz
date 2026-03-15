import { NextRequest, NextResponse } from "next/server";
import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { extractionSchema } from "@/lib/schemas/quote";
import { rateLimit } from "@/lib/rateLimit";
import { captureError } from "@/lib/sentry";

const SYSTEM_PROMPT = `You are a quote extraction assistant for New Zealand tradies (plumbers, electricians, landscapers, etc.).

Your task is to extract structured quote information from transcribed voice recordings.

IMPORTANT - Use New Zealand English spelling:
- "labour" not "labor"
- "colour" not "color"
- "centre" not "center"
- "metre" not "meter"
- "organised" not "organized"
- "specialised" not "specialized"
- "mobilisation" not "mobilization"
- "aluminium" not "aluminum"
- "tyre" not "tire"
- "grey" not "gray"

NZ Context:
- Currency is always NZD ($)
- GST is 15% (but don't calculate it, just extract the raw prices mentioned)
- Common Kiwi slang:
  - "grand" = $1,000
  - "bucks" = dollars
  - "a couple hundred" = approximately $200
  - "few hundred" = approximately $300-500
  - "arvo" = afternoon
  - "smoko" = break time
  - "she'll be right" = it will be fine

Instructions:
1. Extract customer name, phone, email, and address if mentioned
2. List each work item/service with quantity and unit price
3. Include any special notes or instructions
4. Set confidence score (0-1) based on how clear the transcription was
5. Always use NZ English spelling in all output text

Be generous with interpretation but conservative with confidence scores.
If something is unclear, use your best judgment but lower the confidence.
If no price is mentioned for an item, estimate based on common NZ trade rates or set to 0.`;

export async function POST(request: NextRequest) {
  // Rate limit: 15 extractions per minute per IP
  const rateLimited = rateLimit(request, { limit: 15, windowSeconds: 60 });
  if (rateLimited) return rateLimited;

  try {
    if (!process.env.OPENAI_API_KEY) {
      console.error("OPENAI_API_KEY is not set");
      return NextResponse.json(
        { error: "Server configuration error: Missing OpenAI API key" },
        { status: 500 }
      );
    }

    const { text } = await request.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { error: "No text provided" },
        { status: 400 }
      );
    }

    if (text.trim().length < 5) {
      return NextResponse.json(
        { error: "Text too short to extract quote" },
        { status: 400 }
      );
    }

    const result = await generateObject({
      model: openai("gpt-4o-mini"),
      schema: extractionSchema,
      system: SYSTEM_PROMPT,
      prompt: `Extract quote information from this transcribed voice recording:\n\n"${text}"`,
    });

    return NextResponse.json(result.object);
  } catch (error) {
    console.error("Extraction error:", error);
    captureError(error, { route: "/api/extract" });

    if (error instanceof Error) {
      console.error("Error message:", error.message);

      if (error.message.includes("rate limit")) {
        return NextResponse.json(
          { error: "Too many requests. Please try again." },
          { status: 429 }
        );
      }

      if (error.message.includes("API key") || error.message.includes("401") || error.message.includes("Unauthorized")) {
        return NextResponse.json(
          { error: "Invalid OpenAI API key" },
          { status: 401 }
        );
      }

      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: "Failed to extract quote data" },
      { status: 500 }
    );
  }
}
