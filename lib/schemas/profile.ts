import { z } from "zod";

// NZ bank account: bank(2)-branch(4)-account(7)-suffix(2 or 3).
// CLAUDE.md specifies XX-XXXX-XXXXXXX-XX; three-digit suffixes are also issued
// in practice, so both are accepted.
export const NZ_BANK_ACCOUNT_PATTERN = /^\d{2}-\d{4}-\d{7}-\d{2,3}$/;

/** Trim, then treat an empty string as "cleared". */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();

export const profileUpdateSchema = z.object({
  fullName: optionalText(200),
  businessName: optionalText(200),
  phone: optionalText(40),
  address: optionalText(500),
  email: z
    .string()
    .trim()
    .max(320) // RFC 5321
    .email("email must be a valid address")
    .or(z.literal(""))
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional(),
  // Wrong here means the customer wires money to the wrong account, so this is
  // validated rather than stored as typed. It reaches the customer through
  // provider_details on the quote.
  bankAccount: z
    .string()
    .trim()
    .regex(
      NZ_BANK_ACCOUNT_PATTERN,
      "bankAccount must be in NZ format, e.g. 12-3456-7890123-00"
    )
    .or(z.literal(""))
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional(),
});

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;

/** First error only — the UI shows one message, not a validation dump. */
export function firstIssueMessage(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "Invalid profile data";
  const field = issue.path.join(".");
  return field ? `${field}: ${issue.message}` : issue.message;
}
