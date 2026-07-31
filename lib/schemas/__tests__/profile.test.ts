import { describe, it, expect } from "vitest";
import { profileUpdateSchema, firstIssueMessage } from "../profile";

function parse(input: Record<string, unknown>) {
  return profileUpdateSchema.safeParse(input);
}

describe("profileUpdateSchema", () => {
  // The whole route previously wrote request body fields straight to the
  // database with no validation of any kind.
  it("accepts a complete, well-formed profile", () => {
    const result = parse({
      fullName: "Dave Wiremu",
      businessName: "Kiwi Plumbing Ltd",
      phone: "021 555 0100",
      email: "dave@kiwiplumbing.co.nz",
      address: "12 Colombo St, Christchurch 8011",
      bankAccount: "12-3456-7890123-00",
    });
    expect(result.success).toBe(true);
  });

  describe("NZ bank account format", () => {
    // Wrong here means the customer wires money to the wrong account. It
    // reaches them through provider_details on the quote.
    it.each([
      ["two-digit suffix", "12-3456-7890123-00"],
      ["three-digit suffix", "12-3456-7890123-000"],
    ])("accepts %s", (_label, bankAccount) => {
      expect(parse({ bankAccount }).success).toBe(true);
    });

    it.each([
      ["no dashes", "1234567890123 00"],
      ["too few branch digits", "12-345-7890123-00"],
      ["too few account digits", "12-3456-789012-00"],
      ["letters", "ab-cdef-ghijklm-no"],
      ["free text", "ask me for it"],
      ["four-digit suffix", "12-3456-7890123-0000"],
    ])("rejects %s", (_label, bankAccount) => {
      const result = parse({ bankAccount });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(firstIssueMessage(result.error)).toContain("NZ format");
      }
    });

    it("treats an empty string as clearing the field", () => {
      const result = parse({ bankAccount: "" });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.bankAccount).toBeNull();
    });
  });

  describe("length caps", () => {
    it.each([
      ["fullName", 201],
      ["businessName", 201],
      ["phone", 41],
      ["address", 501],
    ])("rejects an oversized %s", (field, length) => {
      const result = parse({ [field]: "x".repeat(length) });
      expect(result.success).toBe(false);
    });

    it("rejects an email over the RFC 5321 limit", () => {
      const local = "x".repeat(320);
      expect(parse({ email: `${local}@example.com` }).success).toBe(false);
    });
  });

  describe("email", () => {
    it("rejects a malformed address", () => {
      const result = parse({ email: "not-an-email" });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(firstIssueMessage(result.error)).toContain("email");
      }
    });

    it("treats an empty string as clearing the field", () => {
      const result = parse({ email: "" });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.email).toBeNull();
    });
  });

  it("rejects non-string values rather than coercing them", () => {
    expect(parse({ fullName: { toString: "gotcha" } }).success).toBe(false);
    expect(parse({ phone: 12345 }).success).toBe(false);
  });

  it("trims surrounding whitespace", () => {
    const result = parse({ businessName: "  Kiwi Plumbing Ltd  " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.businessName).toBe("Kiwi Plumbing Ltd");
  });

  it("allows a partial update", () => {
    expect(parse({ phone: "021 555 0100" }).success).toBe(true);
    expect(parse({}).success).toBe(true);
  });
});
