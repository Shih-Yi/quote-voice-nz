import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../route";

// Mock the AI SDK
vi.mock("ai", () => ({
  generateObject: vi.fn(),
}));

vi.mock("@ai-sdk/openai", () => ({
  openai: vi.fn(() => "mock-model"),
}));

import { generateObject } from "ai";

const mockGenerateObject = vi.mocked(generateObject);

function makeRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost:3000/api/extract", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/extract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set env var
    vi.stubEnv("OPENAI_API_KEY", "test-key");
  });

  it("returns 400 when no text provided", async () => {
    const request = makeRequest({});
    const response = await POST(request as never);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain("No text provided");
  });

  it("returns 400 when text is too short", async () => {
    const request = makeRequest({ text: "Hi" });
    const response = await POST(request as never);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain("too short");
  });

  it("returns 500 when OPENAI_API_KEY is missing", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const request = makeRequest({ text: "Fix the kitchen tap, about 200 bucks" });
    const response = await POST(request as never);
    expect(response.status).toBe(500);
  });

  it("returns extracted data on success", async () => {
    const mockResult = {
      customerName: "Dave",
      customerPhone: null,
      customerEmail: null,
      customerAddress: null,
      items: [
        { description: "Fix kitchen tap", quantity: 1, unitPrice: 200 },
      ],
      notes: null,
      confidence: 0.8,
    };

    mockGenerateObject.mockResolvedValueOnce({
      object: mockResult,
    } as never);

    const request = makeRequest({ text: "Fix the kitchen tap for Dave, about 200 bucks" });
    const response = await POST(request as never);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.customerName).toBe("Dave");
    expect(data.items).toHaveLength(1);
    expect(data.confidence).toBe(0.8);
  });

  it("returns 429 on rate limit error", async () => {
    mockGenerateObject.mockRejectedValueOnce(new Error("rate limit exceeded"));

    const request = makeRequest({ text: "Fix the kitchen tap, about 200 bucks" });
    const response = await POST(request as never);
    expect(response.status).toBe(429);
  });

  it("returns 401 on API key error", async () => {
    mockGenerateObject.mockRejectedValueOnce(new Error("Invalid API key"));

    const request = makeRequest({ text: "Fix the kitchen tap, about 200 bucks" });
    const response = await POST(request as never);
    expect(response.status).toBe(401);
  });
});
