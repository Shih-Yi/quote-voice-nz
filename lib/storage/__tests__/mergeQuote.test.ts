import { describe, it, expect } from "vitest";
import type { Quote, QuoteAttachment } from "@/types/quote";
import { mergeCloudQuote } from "../mergeQuote";

function makeQuote(partial: Partial<Quote> & { id: string }): Quote {
  return {
    slug: `slug-${partial.id}`,
    customerName: "Customer",
    items: [],
    gstInclusive: false,
    subtotal: 0,
    gst: 0,
    total: 0,
    status: "draft",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

const attachment: QuoteAttachment = {
  id: "att-1",
  name: "site-photo.jpg",
  dataUrl: "data:image/jpeg;base64,abc",
  mimeType: "image/jpeg",
  size: 1234,
  createdAt: "2026-01-01T00:00:00.000Z",
};

describe("mergeCloudQuote", () => {
  it("keeps cloud values for synced fields", () => {
    const local = makeQuote({ id: "q1", customerName: "Local", total: 10 });
    const cloud = makeQuote({
      id: "q1",
      customerName: "Cloud",
      total: 99,
      updatedAt: "2026-02-01T00:00:00.000Z",
    });

    const merged = mergeCloudQuote(local, cloud);

    expect(merged.customerName).toBe("Cloud");
    expect(merged.total).toBe(99);
    expect(merged.updatedAt).toBe("2026-02-01T00:00:00.000Z");
  });

  it("preserves local-only fields the cloud row never carries", () => {
    const local = makeQuote({
      id: "q1",
      attachments: [attachment],
      signatureDataUrl: "data:image/png;base64,sig",
      ownerToken: "secret-token",
    });
    const cloud = makeQuote({
      id: "q1",
      customerName: "Cloud",
      updatedAt: "2026-02-01T00:00:00.000Z",
    });

    const merged = mergeCloudQuote(local, cloud);

    expect(merged.attachments).toEqual([attachment]);
    expect(merged.signatureDataUrl).toBe("data:image/png;base64,sig");
    expect(merged.ownerToken).toBe("secret-token");
  });

  it("leaves local-only fields undefined when local has none", () => {
    const local = makeQuote({ id: "q1" });
    const cloud = makeQuote({ id: "q1" });

    const merged = mergeCloudQuote(local, cloud);

    expect(merged.attachments).toBeUndefined();
    expect(merged.signatureDataUrl).toBeUndefined();
    expect(merged.ownerToken).toBeUndefined();
  });

  it("returns a new object without mutating either input", () => {
    const local = makeQuote({ id: "q1", attachments: [attachment] });
    const cloud = makeQuote({ id: "q1", customerName: "Cloud" });
    const localSnapshot = structuredClone(local);
    const cloudSnapshot = structuredClone(cloud);

    const merged = mergeCloudQuote(local, cloud);

    expect(merged).not.toBe(local);
    expect(merged).not.toBe(cloud);
    expect(local).toEqual(localSnapshot);
    expect(cloud).toEqual(cloudSnapshot);
  });
});
