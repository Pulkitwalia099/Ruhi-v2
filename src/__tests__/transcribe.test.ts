import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({
  env: { OPENAI_API_KEY: "test-key-123" },
}));

import { transcribeAudio } from "@/lib/ai/transcribe";

describe("transcribeAudio", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("returns transcribed text on success", async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({ text: "hello yaar kaise ho" }),
    };
    vi.mocked(global.fetch).mockResolvedValue(mockResponse as Response);

    const result = await transcribeAudio(Buffer.from("fake-audio"));
    expect(result).toBe("hello yaar kaise ho");
  });

  it("sends correct multipart form data to Whisper API", async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({ text: "test" }),
    };
    vi.mocked(global.fetch).mockResolvedValue(mockResponse as Response);

    await transcribeAudio(Buffer.from("audio-data"), "audio/ogg");

    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.openai.com/v1/audio/transcriptions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-key-123",
        }),
      })
    );
  });

  it("returns null when API returns error", async () => {
    const mockResponse = {
      ok: false,
      status: 500,
      text: async () => "Internal Server Error",
    };
    vi.mocked(global.fetch).mockResolvedValue(mockResponse as Response);

    const result = await transcribeAudio(Buffer.from("fake-audio"));
    expect(result).toBeNull();
  });

  it("returns null when transcription is empty", async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({ text: "" }),
    };
    vi.mocked(global.fetch).mockResolvedValue(mockResponse as Response);

    const result = await transcribeAudio(Buffer.from("fake-audio"));
    expect(result).toBeNull();
  });

  it("returns null when transcription is whitespace only", async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({ text: "   " }),
    };
    vi.mocked(global.fetch).mockResolvedValue(mockResponse as Response);

    const result = await transcribeAudio(Buffer.from("fake-audio"));
    expect(result).toBeNull();
  });

  it("returns null for oversized buffers (>25MB)", async () => {
    // Create a buffer just over 25MB
    const oversized = Buffer.alloc(25 * 1024 * 1024 + 1);
    const result = await transcribeAudio(oversized);
    expect(result).toBeNull();
    // Should NOT have called fetch
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns null when fetch throws a network error", async () => {
    vi.mocked(global.fetch).mockRejectedValue(new Error("network down"));

    const result = await transcribeAudio(Buffer.from("fake-audio"));
    expect(result).toBeNull();
  });
});
