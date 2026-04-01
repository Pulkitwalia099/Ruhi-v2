import "server-only";

import { env } from "@/lib/env";

const GROQ_WHISPER_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB — Whisper API limit

/**
 * Transcribe an audio buffer to text using Groq's Whisper endpoint.
 * Uses whisper-large-v3-turbo — same quality as OpenAI, ~5-10x faster.
 * Returns the transcribed text, or null on failure.
 */
export async function transcribeAudio(
  audioBuffer: Buffer,
  mimeType = "audio/ogg"
): Promise<string | null> {
  if (audioBuffer.length > MAX_FILE_SIZE) {
    console.warn("[Transcribe] File too large:", audioBuffer.length, "bytes");
    return null;
  }

  const apiKey = env.GROQ_API_KEY ?? env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn("[Transcribe] GROQ_API_KEY (or OPENAI_API_KEY) not set, skipping transcription");
    return null;
  }

  const useGroq = !!env.GROQ_API_KEY;
  const whisperUrl = useGroq
    ? GROQ_WHISPER_URL
    : "https://api.openai.com/v1/audio/transcriptions";
  const modelName = useGroq ? "whisper-large-v3-turbo" : "whisper-1";

  try {
    const EXT_MAP: Record<string, string> = {
      "audio/ogg": "ogg",
      "audio/mp4": "m4a",
      "audio/x-m4a": "m4a",
      "audio/mpeg": "mp3",
      "audio/webm": "webm",
      "audio/wav": "wav",
    };
    const ext = EXT_MAP[mimeType] ?? "ogg";
    const form = new FormData();
    form.append(
      "file",
      new Blob([audioBuffer], { type: mimeType }),
      `voice.${ext}`
    );
    form.append("model", modelName);
    // Force Hindi (Devanagari) output — without this, Whisper sometimes
    // outputs Urdu script for Hindi speech, confusing the downstream LLM
    form.append("language", "hi");

    const res = await fetch(whisperUrl, {
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
