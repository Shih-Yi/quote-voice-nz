import { z } from "zod";

export const lineItemSchema = z.object({
  description: z.string().describe("Description of the work item or service"),
  quantity: z.number().describe("Quantity of items or hours, default to 1 if not specified"),
  unitPrice: z.number().describe("Price per unit in NZD, use 0 if not mentioned"),
});

export const extractionSchema = z.object({
  customerName: z.string().nullable().describe("Customer's full name, null if not mentioned"),
  customerPhone: z.string().nullable().describe("Customer's phone number, null if not mentioned"),
  customerEmail: z.string().nullable().describe("Customer's email address, null if not mentioned"),
  customerAddress: z.string().nullable().describe("Customer's address in NZ format, null if not mentioned"),
  items: z.array(lineItemSchema).describe("List of work items or services quoted"),
  notes: z.string().nullable().describe("Additional notes or special instructions, null if none"),
  confidence: z.number().describe("Confidence score 0-1 for the extraction accuracy"),
});

export const quoteSchema = z.object({
  id: z.string(),
  customerName: z.string(),
  customerPhone: z.string().optional(),
  customerEmail: z.string().email().optional(),
  customerAddress: z.string().optional(),
  items: z.array(
    z.object({
      id: z.string(),
      description: z.string(),
      quantity: z.number(),
      unitPrice: z.number(),
      total: z.number(),
    })
  ),
  notes: z.string().optional(),
  gstInclusive: z.boolean(),
  subtotal: z.number(),
  gst: z.number(),
  total: z.number(),
  status: z.enum(["draft", "sent", "accepted"]),
  createdAt: z.string(),
  updatedAt: z.string(),
  slug: z.string().optional(),
});

export type LineItemInput = z.infer<typeof lineItemSchema>;
export type ExtractionOutput = z.infer<typeof extractionSchema>;
export type QuoteData = z.infer<typeof quoteSchema>;
