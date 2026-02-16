import { describe, it, expect } from "vitest";
import { lineItemSchema, extractionSchema } from "../quote";

describe("lineItemSchema", () => {
  it("validates a valid line item", () => {
    const result = lineItemSchema.safeParse({
      description: "General labour",
      quantity: 2,
      unitPrice: 85,
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing description", () => {
    const result = lineItemSchema.safeParse({
      quantity: 1,
      unitPrice: 50,
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-numeric quantity", () => {
    const result = lineItemSchema.safeParse({
      description: "Plumbing work",
      quantity: "two",
      unitPrice: 100,
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing unitPrice", () => {
    const result = lineItemSchema.safeParse({
      description: "Plumbing work",
      quantity: 1,
    });
    expect(result.success).toBe(false);
  });

  it("accepts zero values", () => {
    const result = lineItemSchema.safeParse({
      description: "TBC item",
      quantity: 0,
      unitPrice: 0,
    });
    expect(result.success).toBe(true);
  });
});

describe("extractionSchema", () => {
  it("validates a complete extraction", () => {
    const result = extractionSchema.safeParse({
      customerName: "John Smith",
      customerPhone: "021 123 4567",
      customerEmail: "john@example.co.nz",
      customerAddress: "123 Queen Street, Auckland",
      items: [
        { description: "General labour", quantity: 4, unitPrice: 85 },
        { description: "Copper pipe 15mm", quantity: 10, unitPrice: 12.5 },
      ],
      notes: "Access via side gate",
      confidence: 0.85,
    });
    expect(result.success).toBe(true);
  });

  it("allows null optional fields", () => {
    const result = extractionSchema.safeParse({
      customerName: null,
      customerPhone: null,
      customerEmail: null,
      customerAddress: null,
      items: [],
      notes: null,
      confidence: 0.3,
    });
    expect(result.success).toBe(true);
  });

  it("rejects confidence outside 0-1 when not a number", () => {
    const result = extractionSchema.safeParse({
      customerName: null,
      customerPhone: null,
      customerEmail: null,
      customerAddress: null,
      items: [],
      notes: null,
      confidence: "high",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing items field", () => {
    const result = extractionSchema.safeParse({
      customerName: "Test",
      customerPhone: null,
      customerEmail: null,
      customerAddress: null,
      notes: null,
      confidence: 0.5,
    });
    expect(result.success).toBe(false);
  });
});
