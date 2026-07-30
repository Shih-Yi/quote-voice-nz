import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { rateLimit } from "@/lib/rateLimit";
import { claimIdempotencyKey } from "@/lib/idempotency";
import { getServerSupabase } from "@/lib/supabase/server";
import { getCurrentUserServer } from "@/lib/supabase/auth-server";
import {
  checkAndIncrementUsage,
  getMonthlyUsage,
  getUserTier,
  TIER_LIMITS,
} from "@/lib/supabase/subscription";
import { formatNZD } from "@/lib/utils/currency";

// Double-submit guard. Long enough to absorb an impatient second tap or a
// client retry on a slow network, short enough that a deliberate re-send a
// minute later still goes through.
const IDEMPOTENCY_TTL_SECONDS = 60;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LEN = 320; // RFC 5321

interface QuoteEmailRow {
  id: string;
  slug: string;
  status: string;
  user_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  total: number | null;
}

// Strip anything that could break out of the From header's display-name slot
// or inject additional headers. Belt and braces on top of Resend's own
// handling — this value originates from user-editable profile data.
function sanitiseDisplayName(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .replace(/[\r\n]+/g, " ")
    .replace(/["<>,;:]/g, "")
    .trim()
    .slice(0, 78); // RFC 5322 recommended line length
}

// The public link must be derived server-side. Taking it from the request body
// would let any authenticated caller send a mail from our verified domain with
// an arbitrary destination — see the audit note on this route.
function resolveAppOrigin(request: NextRequest): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/+$/, "");
  return request.nextUrl.origin;
}

export async function POST(request: NextRequest) {
  // Rate limit: 5 emails per minute per IP
  const rateLimited = await rateLimit(request, { limit: 5, windowSeconds: 60 });
  if (rateLimited) return rateLimited;

  // Auth required for email sending
  const user = await getCurrentUserServer();
  if (!user) {
    return NextResponse.json(
      { error: "Authentication required to send emails" },
      { status: 401 }
    );
  }

  const supabase = getServerSupabase();
  if (!supabase) {
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 }
    );
  }

  try {
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        { error: "Email service not configured" },
        { status: 503 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const quoteId = typeof body?.quoteId === "string" ? body.quoteId : "";
    const requestedTo = typeof body?.to === "string" ? body.to.trim() : "";

    if (!quoteId) {
      return NextResponse.json(
        { error: "quoteId is required" },
        { status: 400 }
      );
    }

    if (requestedTo && requestedTo.length > MAX_EMAIL_LEN) {
      return NextResponse.json(
        { error: "Invalid email address" },
        { status: 400 }
      );
    }

    // Everything the email says about the quote comes from this row, never
    // from the request body.
    const { data: quote, error: quoteError } = await supabase
      .from("quotes")
      .select("id, slug, status, user_id, customer_name, customer_email, total")
      .eq("id", quoteId)
      .maybeSingle<QuoteEmailRow>();

    if (quoteError) {
      console.error("[/api/send-quote] Quote lookup error:", quoteError);
      return NextResponse.json(
        { error: "Failed to load quote" },
        { status: 500 }
      );
    }

    if (!quote) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    // Ownership. Emailing is an authenticated action, so an unbound
    // (anonymous) row is not this user's to send.
    if (!quote.user_id || quote.user_id !== user.id) {
      console.warn(
        `[/api/send-quote] DENIED quote=${quoteId} owner=${quote.user_id ?? "anon"} session=${user.id}`
      );
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // The public /q/[slug] RPC only resolves sent/accepted rows, so emailing a
    // draft would send the customer to a dead link.
    if (quote.status !== "sent" && quote.status !== "accepted") {
      return NextResponse.json(
        {
          error:
            "Mark this quote as sent before emailing it — the link won't open for your customer yet.",
          status: quote.status,
        },
        { status: 409 }
      );
    }

    const to = requestedTo || quote.customer_email || "";
    if (!to || !EMAIL_RE.test(to)) {
      return NextResponse.json(
        { error: "Invalid email address" },
        { status: 400 }
      );
    }

    // Quota check before sending, increment after. A server-side failure or a
    // missing Resend key must not cost the user a credit.
    const tier = await getUserTier(user.id);
    const limit = TIER_LIMITS[tier].emailsPerMonth;
    const usage = await getMonthlyUsage(user.id);
    if (usage.emailsSent >= limit) {
      return NextResponse.json(
        {
          error: "quota_exceeded",
          limit,
          used: usage.emailsSent,
          tier,
        },
        { status: 429 }
      );
    }

    // Double-tap guard, keyed on what actually identifies the send.
    const isFirstCall = await claimIdempotencyKey(
      `send-quote:${user.id}:${quoteId}:${to.toLowerCase()}`,
      IDEMPOTENCY_TTL_SECONDS
    );
    if (!isFirstCall) {
      console.log(
        `[/api/send-quote] IDEMPOTENT_HIT quote=${quoteId} user=${user.id}`
      );
      return NextResponse.json({ success: true, deduplicated: true });
    }

    // Sender identity comes from the owner's profile, not the request.
    const { data: profile } = await supabase
      .from("profiles")
      .select("business_name")
      .eq("id", user.id)
      .maybeSingle<{ business_name: string | null }>();

    const providerName =
      sanitiseDisplayName(profile?.business_name) || "KiwiSpeakQuote";
    const quoteUrl = `${resolveAppOrigin(request)}/q/${quote.slug}`;
    const total = quote.total != null ? formatNZD(Number(quote.total)) : "";
    const customerName = quote.customer_name?.trim() || "there";

    const resend = new Resend(process.env.RESEND_API_KEY);
    const fromEmail = process.env.RESEND_FROM_EMAIL || "quotes@ksq.nz";

    const { error } = await resend.emails.send({
      from: `${providerName} <${fromEmail}>`,
      replyTo: user.email ?? undefined,
      to: [to],
      subject: `Quote from ${providerName}${total ? ` — ${total}` : ""}`,
      html: buildQuoteEmailHtml({
        customerName,
        providerName,
        quoteUrl,
        total,
      }),
    });

    if (error) {
      console.error("[/api/send-quote] Resend error:", error);
      return NextResponse.json(
        { error: "Failed to send email" },
        { status: 500 }
      );
    }

    // Sent — now it costs a credit.
    const counted = await checkAndIncrementUsage(user.id, "emails_sent");
    if (!counted.allowed) {
      // A concurrent send took the last credit between our pre-check and here.
      // The mail is already out; log rather than lie to the user about it.
      console.warn(
        `[/api/send-quote] QUOTA_RACE quote=${quoteId} user=${user.id} — sent past limit ${counted.limit}`
      );
    }

    console.log(`[/api/send-quote] OK quote=${quoteId} user=${user.id}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[/api/send-quote] Exception:", error);
    return NextResponse.json(
      { error: "Failed to send email" },
      { status: 500 }
    );
  }
}

function buildQuoteEmailHtml(params: {
  customerName: string;
  providerName: string;
  quoteUrl: string;
  total: string;
}): string {
  const { customerName, providerName, quoteUrl, total } = params;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:480px;background:#fff;border-radius:12px;overflow:hidden;">
        <!-- Header -->
        <tr><td style="background:#6366F1;padding:24px;text-align:center;">
          <h1 style="color:#fff;margin:0;font-size:20px;">Quote from ${escapeHtml(providerName)}</h1>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:24px;">
          <p style="color:#111827;font-size:16px;margin:0 0 16px;">
            Kia ora ${escapeHtml(customerName)},
          </p>
          <p style="color:#6B7280;font-size:14px;margin:0 0 24px;">
            You&rsquo;ve received a quote${total ? ` for <strong style="color:#111827;">${escapeHtml(total)}</strong>` : ""}. View the full details below.
          </p>

          <!-- CTA Button -->
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td align="center" style="padding:8px 0 24px;">
              <a href="${escapeHtml(quoteUrl)}" style="background:#6366F1;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:16px;font-weight:600;display:inline-block;">
                View Quote
              </a>
            </td></tr>
          </table>

          <p style="color:#9CA3AF;font-size:12px;margin:0;word-break:break-all;">
            Or copy this link: <a href="${escapeHtml(quoteUrl)}" style="color:#6366F1;">${escapeHtml(quoteUrl)}</a>
          </p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:16px 24px;background:#F9FAFB;border-top:1px solid #E5E7EB;text-align:center;">
          <p style="color:#9CA3AF;font-size:11px;margin:0;">
            Sent via KiwiSpeakQuote &mdash; Voice to Quote for NZ Tradies
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`.trim();
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
