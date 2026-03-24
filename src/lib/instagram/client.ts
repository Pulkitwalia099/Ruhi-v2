const GRAPH_API = "https://graph.instagram.com/v22.0";

/**
 * Instagram Messaging API client (via Instagram Graph API).
 *
 * Key differences from TelegramClient:
 * - Uses Instagram Graph API with Instagram Access Token (IGA prefix)
 * - Token passed as query parameter (not Bearer header)
 * - Message limit is 1000 chars (not 4096)
 * - Images must be sent as public URLs (not buffer uploads)
 * - User IDs are strings (page-scoped), not bigints
 */
export class InstagramClient {
  constructor(
    private accessToken: string,
    private pageId: string,
  ) {}

  /**
   * Send a text message to an Instagram user.
   * Splits at 1000 chars if needed.
   */
  async sendMessage(recipientId: string, text: string) {
    const chunks = this.splitMessage(text, 1000);
    for (const chunk of chunks) {
      await this.callSendAPI(recipientId, { text: chunk });
    }
  }

  /**
   * Send an image by public URL (e.g. Vercel Blob URL).
   * Instagram does NOT accept buffer uploads — the image must be
   * publicly accessible on the internet.
   */
  async sendImage(recipientId: string, imageUrl: string) {
    await this.callSendAPI(recipientId, {
      attachment: {
        type: "image",
        payload: { url: imageUrl, is_reusable: true },
      },
    });
  }

  /**
   * Show "typing..." indicator in the chat.
   */
  async sendTypingIndicator(recipientId: string) {
    await fetch(
      `${GRAPH_API}/me/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.accessToken}`,
        },
        body: JSON.stringify({
          recipient: { id: recipientId },
          sender_action: "typing_on",
        }),
      },
    );
  }

  /**
   * Download an image from a URL (from webhook payload).
   * Instagram provides CDN URLs directly — no two-step getFile like Telegram.
   */
  async downloadImage(url: string): Promise<Buffer> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to download image: ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }

  /**
   * Core method: sends a message via the Instagram Graph API Send endpoint.
   * Token is passed as a query parameter (required for IGA tokens).
   */
  private async callSendAPI(
    recipientId: string,
    messagePayload: Record<string, unknown>,
  ) {
    const res = await fetch(
      `${GRAPH_API}/me/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.accessToken}`,
        },
        body: JSON.stringify({
          recipient: { id: recipientId },
          messaging_type: "RESPONSE",
          message: messagePayload,
        }),
      },
    );

    if (!res.ok) {
      const error = await res.text();
      throw new Error(`Instagram Send API failed (${res.status}): ${error}`);
    }

    return res.json();
  }

  /**
   * Splits long messages at natural break points to respect
   * Instagram's 1000 character limit per message.
   */
  private splitMessage(text: string, maxLength: number): string[] {
    if (text.length <= maxLength) return [text];
    const chunks: string[] = [];
    let remaining = text;
    while (remaining.length > 0) {
      if (remaining.length <= maxLength) {
        chunks.push(remaining);
        break;
      }
      let splitAt = remaining.lastIndexOf("\n", maxLength);
      if (splitAt < maxLength / 2)
        splitAt = remaining.lastIndexOf(". ", maxLength);
      if (splitAt < maxLength / 2) splitAt = maxLength;
      chunks.push(remaining.slice(0, splitAt));
      remaining = remaining.slice(splitAt).trimStart();
    }
    return chunks;
  }
}
