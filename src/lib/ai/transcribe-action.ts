"use server";

import { transcribeAudio } from "./transcribe";

/**
 * Server action for web voice input.
 * Accepts base64-encoded audio, returns transcribed text.
 *
 * The UI component to record audio will be built by the P1 team
 * in the chat interface later — this just provides the backend.
 */
export async function transcribeVoiceNote(
  base64Audio: string,
  mimeType: string = "audio/webm",
): Promise<{ text: string | null; error?: string }> {
  try {
    const buffer = Buffer.from(base64Audio, "base64");
    const text = await transcribeAudio(buffer, mimeType);
    return { text };
  } catch (err) {
    console.error("[TranscribeAction] Failed:", err);
    return { text: null, error: "Transcription failed" };
  }
}
