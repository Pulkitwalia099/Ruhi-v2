import type { InstagramClient } from "./client";

export async function sendSplitMessages(
  ig: InstagramClient,
  recipientId: string,
  text: string,
): Promise<void> {
  const chunks = text
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
