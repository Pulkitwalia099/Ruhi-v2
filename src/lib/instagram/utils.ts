import type { InstagramClient } from "./client";

/**
 * Max characters per chunk before we force-split.
 * Instagram hard limit is 1000, but we target 600 for readability.
 */
const MAX_CHUNK_CHARS = 600;

/**
 * If the LLM forgot to add ||| splits and the text is long,
 * force-split at sentence boundaries so messages feel natural
 * instead of getting mechanically chopped mid-sentence by the client.
 */
function ensureSplits(text: string): string {
  // If already has ||| splits, trust the LLM
  if (text.includes("|||")) return text;

  // Short enough — no split needed
  if (text.length <= MAX_CHUNK_CHARS) return text;

  // Force-split at sentence boundaries
  const sentences = text.match(/[^.!?]+[.!?]+[\s]*/g) ?? [text];
  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    if (current.length + sentence.length > MAX_CHUNK_CHARS && current.length > 0) {
      chunks.push(current.trim());
      current = sentence;
    } else {
      current += sentence;
    }
  }
  if (current.trim()) chunks.push(current.trim());

  return chunks.join("|||");
}

export async function sendSplitMessages(
  ig: InstagramClient,
  recipientId: string,
  text: string,
): Promise<void> {
  const safeText = ensureSplits(text);
  const chunks = safeText
    .split("|||")
    .map((c) => c.trim())
    .filter(Boolean);
  for (let i = 0; i < chunks.length; i++) {
    await ig.sendTypingIndicator(recipientId);
    if (i > 0) {
      const delay = Math.min(Math.max(chunks[i].length * 50, 800), 3000);
      await new Promise((r) => setTimeout(r, delay));
    }
    await ig.sendMessage(recipientId, chunks[i]);
  }
}
