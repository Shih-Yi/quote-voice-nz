import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../route";

// Mock Groq SDK — must use class to be constructor-compatible
const mockCreate = vi.fn();

vi.mock("groq-sdk", () => {
  return {
    default: class MockGroq {
      audio = {
        transcriptions: {
          create: mockCreate,
        },
      };
    },
  };
});

function makeFormData(file?: File): FormData {
  const formData = new FormData();
  if (file) {
    formData.append("audio", file);
  }
  return formData;
}

function makeRequest(formData: FormData): Request {
  return {
    formData: () => Promise.resolve(formData),
  } as unknown as Request;
}

describe("POST /api/transcribe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("GROQ_API_KEY", "test-key");
  });

  it("returns 400 when no audio file provided", async () => {
    const formData = makeFormData();
    const response = await POST(makeRequest(formData) as never);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain("No audio file");
  });

  it("returns 400 when audio file exceeds 25MB", async () => {
    const bigFile = new File(["x"], "big.webm", { type: "audio/webm" });
    Object.defineProperty(bigFile, "size", { value: 26 * 1024 * 1024 });

    const formData = makeFormData(bigFile);
    const response = await POST(makeRequest(formData) as never);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain("too large");
  });

  it("returns 500 when GROQ_API_KEY is missing", async () => {
    vi.stubEnv("GROQ_API_KEY", "");
    const file = new File(["audio"], "test.webm", { type: "audio/webm" });
    const formData = makeFormData(file);
    const response = await POST(makeRequest(formData) as never);
    expect(response.status).toBe(500);
  });

  it("returns transcribed text on success", async () => {
    mockCreate.mockResolvedValueOnce({ text: "Fix the kitchen tap mate" });

    const file = new File(["audio-data"], "recording.webm", { type: "audio/webm" });
    const formData = makeFormData(file);
    const response = await POST(makeRequest(formData) as never);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.text).toBe("Fix the kitchen tap mate");
  });

  it("returns 429 on rate limit error", async () => {
    mockCreate.mockRejectedValueOnce(new Error("rate limit exceeded"));

    const file = new File(["audio-data"], "recording.webm", { type: "audio/webm" });
    const formData = makeFormData(file);
    const response = await POST(makeRequest(formData) as never);
    expect(response.status).toBe(429);
  });

  it("returns 401 on invalid API key", async () => {
    mockCreate.mockRejectedValueOnce(new Error("Invalid API Key"));

    const file = new File(["audio-data"], "recording.webm", { type: "audio/webm" });
    const formData = makeFormData(file);
    const response = await POST(makeRequest(formData) as never);
    expect(response.status).toBe(401);
  });
});
