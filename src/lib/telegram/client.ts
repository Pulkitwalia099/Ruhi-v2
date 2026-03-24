const TELEGRAM_API = "https://api.telegram.org/bot";

/**
 * Lightweight Telegram Bot API client.
 * Handles sending messages, typing indicators, and file downloads.
 */
export class TelegramClient {
  constructor(private token: string) {}

  private async call(method: string, body?: Record<string, unknown>) {
    const res = await fetch(`${TELEGRAM_API}${this.token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok)
      throw new Error(`Telegram API ${method} failed: ${res.status}`);
    return res.json();
  }

  async sendMessage(chatId: number, text: string) {
    const chunks = this.splitMessage(text, 4096);
    for (const chunk of chunks) {
      await this.call("sendMessage", { chat_id: chatId, text: chunk, parse_mode: "Markdown" });
    }
  }

  async sendChatAction(chatId: number, action = "typing") {
    await this.call("sendChatAction", { chat_id: chatId, action });
  }

  /**
   * Sends a message with an inline keyboard (tap buttons).
   * Each button row is an array of { text, callback_data } objects.
   */
  async sendMessageWithKeyboard(
    chatId: number,
    text: string,
    inlineKeyboard: Array<Array<{ text: string; callback_data: string }>>,
  ) {
    await this.call("sendMessage", {
      chat_id: chatId,
      text,
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: inlineKeyboard },
    });
  }

  /**
   * Acknowledges a callback query (dismisses the loading spinner
   * that Telegram shows after a user taps an inline button).
   */
  async answerCallbackQuery(callbackQueryId: string, text?: string) {
    await this.call("answerCallbackQuery", {
      callback_query_id: callbackQueryId,
      ...(text ? { text } : {}),
    });
  }

  /**
   * Removes the inline keyboard from a previously sent message.
   * Good UX: prevents users from re-tapping old buttons.
   */
  async removeInlineKeyboard(chatId: number, messageId: number) {
    await this.call("editMessageReplyMarkup", {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: { inline_keyboard: [] },
    });
  }

  /**
   * Downloads a file from Telegram in two steps:
   * 1. getFile to get the file_path
   * 2. Fetch the binary from the file download endpoint
   */
  async downloadFile(fileId: string): Promise<Buffer> {
    const res = await this.call("getFile", { file_id: fileId });
    const filePath = res.result.file_path;
    const fileUrl = `https://api.telegram.org/file/bot${this.token}/${filePath}`;
    const fileRes = await fetch(fileUrl);
    if (!fileRes.ok)
      throw new Error(`Failed to download file: ${fileRes.status}`);
    return Buffer.from(await fileRes.arrayBuffer());
  }

  /**
   * Send a photo (as Buffer) to a chat. Uses multipart/form-data
   * because Telegram requires binary upload for new images.
   */
  async sendPhoto(chatId: number, photo: Buffer, caption?: string) {
    const form = new FormData();
    form.append("chat_id", String(chatId));
    form.append("photo", new Blob([photo], { type: "image/png" }), "report.png");
    if (caption) form.append("caption", caption);

    const res = await fetch(
      `${TELEGRAM_API}${this.token}/sendPhoto`,
      { method: "POST", body: form },
    );
    if (!res.ok)
      throw new Error(`Telegram API sendPhoto failed: ${res.status}`);
    return res.json();
  }

  /**
   * Splits long messages at natural break points (newlines, sentences)
   * to respect Telegram's 4096 character limit per message.
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
