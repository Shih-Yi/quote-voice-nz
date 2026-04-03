import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { rateLimit } from "@/lib/rateLimit";
import { getCurrentUser } from "@/lib/supabase/auth";
import { checkAndIncrementUsage } from "@/lib/supabase/subscription";

export async function POST(request: NextRequest) {
  // Rate limit: 5 emails per minute per IP
  const rateLimited = rateLimit(request, { limit: 5, windowSeconds: 60 });
  if (rateLimited) return rateLimited;

  // Auth required for email sending
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: "Authentication required to send emails" },
      { status: 401 }
    );
  }

  // Monthly email quota check
  const quotaCheck = await checkAndIncrementUsage(user.id, "emails_sent");
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

  try {
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        { error: "Email service not configured" },
        { status: 503 }
      );
    }

    const { to, customerName, quoteUrl, total, providerName } = await request.json();

    if (!to || !quoteUrl) {
      return NextResponse.json(
        { error: "Missing required fields (to, quoteUrl)" },
        { status: 400 }
      );
    }

    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      return NextResponse.json(
        { error: "Invalid email address" },
        { status: 400 }
      );
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    const fromName = providerName || "KiwiSpeakQuote";
    const fromEmail = process.env.RESEND_FROM_EMAIL || "quotes@ksq.nz";

    const { error } = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: [to],
      subject: `Quote for ${customerName || "you"} — ${total || ""}`,
      html: buildQuoteEmailHtml({
        customerName: customerName || "there",
        providerName: fromName,
        quoteUrl,
        total: total || "",
      }),
    });

    if (error) {
      console.error("Resend error:", error);
      return NextResponse.json(
        { error: "Failed to send email" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Send quote email error:", error);
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
