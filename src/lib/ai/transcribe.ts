import "server-only";

import { env } from "@/lib/env";

const WHISPER_URL = "https://api.openai.com/v1/audio/transcriptions";
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB — Whisper API limit

/**
 * Transcribe an audio buffer to text using OpenAI Whisper.
 * Returns the transcribed text, or null on failure.
 */
export async function transcribeAudio(
  audioBuffer: Buffer,
  mimeType = "audio/ogg",
): Promise<string | null> {
  if (audioBuffer.length > MAX_FILE_SIZE) {
    console.warn("[Transcribe] File too large:", audioBuffer.length, "bytes");
    return null;
  }

  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn("[Transcribe] OPENAI_API_KEY not set, skipping transcription");
    return null;
  }

  try {
    const ext = mimeType === "audio/mp4" ? "m4a" : "ogg";
    const form = new FormData();
    form.append(
      "file",
      new Blob([audioBuffer], { type: mimeType }),
      `voice.${ext}`,
    );
    form.append("model", "whisper-1");

    const res = await fetch(WHISPER_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[Transcribe] Whisper API error:", res.status, errText);
      return null;
    }

    const data = (await res.json()) as { text: string };
    const text = data.text?.trim();

    if (!text) {
      console.warn("[Transcribe] Empty transcription result");
      return null;
    }

    return text;
  } catch (err: any) {
    console.error("[Transcribe] Failed:", err?.message || err);
    return null;
  }
}
