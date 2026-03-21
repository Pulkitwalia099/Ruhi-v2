import { put } from "@vercel/blob";

import { runRuhiAgent } from "@/lib/ai/agent";
import {
  getOrCreateConversation,
  getRecentMessages,
  saveMessage,
  upsertTelegramUser,
} from "@/db/queries";
import { TelegramClient } from "./client";

// ------------------------------------------------
// src/lib/telegram/handler.ts
//
// Processes incoming Telegram updates: text, photos,
// and slash commands. Persists messages in our DB
// and runs the Ruhi agent for responses.
// ------------------------------------------------

/** Set of update_ids already processed (in-memory, per instance). */
const processedUpdates = new Set<number>();

/** Maximum stored update_ids before pruning oldest entries. */
const MAX_PROCESSED = 10_000;

/**
 * Telegram Update shape (subset of fields we use).
 * Full spec: https://core.telegram.org/bots/api#update
 */
export interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from?: {
      id: number;
      is_bot: boolean;
      first_name: string;
      username?: string;
    };
    chat: { id: number; type: string };
    date: number;
    text?: string;
    photo?: Array<{ file_id: string; file_unique_id: string; width: number; height: number; file_size?: number }>;
    caption?: string;
    entities?: Array<{ type: string; offset: number; length: number }>;
  };
}

/**
 * Process a single Telegram update.
 * Called inside `after()` so the HTTP 200 has already been returned.
 */
export async function processTelegramUpdate(
  update: TelegramUpdate,
  botToken: string,
) {
  // --- Idempotency: skip duplicate updates ---
  if (processedUpdates.has(update.update_id)) {
    return;
  }
  processedUpdates.add(update.update_id);
  if (processedUpdates.size > MAX_PROCESSED) {
    // Prune oldest half
    const entries = [...processedUpdates];
    for (let i = 0; i < entries.length / 2; i++) {
      processedUpdates.delete(entries[i]);
    }
  }

  const msg = update.message;
  if (!msg || !msg.from || msg.from.is_bot) return;

  const tg = new TelegramClient(botToken);
  const chatId = msg.chat.id;

  try {
    // --- Handle slash commands ---
    if (msg.text && msg.entities?.some((e) => e.type === "bot_command")) {
      const handled = await handleCommand(msg.text, chatId, msg.from, tg);
      if (handled) return;
    }

    // --- Upsert user and get/create conversation ---
    const dbUser = await upsertTelegramUser({
      telegramId: BigInt(msg.from.id),
      username: msg.from.username,
    });

    const conversation = await getOrCreateConversation({ userId: dbUser.id });

    // --- Build user content (text + optional photo) ---
    let userText = msg.text ?? msg.caption ?? "";
    let imageUrl: string | undefined;

    if (msg.photo && msg.photo.length > 0) {
      // Use the largest photo (last in array)
      const largestPhoto = msg.photo[msg.photo.length - 1];
      const photoBuffer = await tg.downloadFile(largestPhoto.file_id);

      // Upload to Vercel Blob
      const blob = await put(
        `telegram-photos/${dbUser.id}/${Date.now()}.jpg`,
        photoBuffer,
        { access: "public", contentType: "image/jpeg" },
      );
      imageUrl = blob.url;

      if (!userText) {
        userText = "Sent a photo for skin analysis";
      }
    }

    // --- Save user message to DB ---
    await saveMessage({
      conversationId: conversation.id,
      role: "user",
      content: userText,
    });

    // --- Load recent messages for multi-turn context ---
    const recentMessages = await getRecentMessages({
      conversationId: conversation.id,
      limit: 30,
    });

    // Convert DB messages to AI SDK format
    const aiMessages = recentMessages.map((m) => {
      const parts = m.parts as Array<{ type: string; text?: string }>;
      const textContent = parts
        .filter((p) => p.type === "text" && p.text)
        .map((p) => p.text!)
        .join("\n");

      return {
        role: m.role as "user" | "assistant",
        content: [{ type: "text" as const, text: textContent }],
      };
    });

    // If the user sent a photo, add image content to the last user message
    if (imageUrl) {
      const lastMsg = aiMessages[aiMessages.length - 1];
      if (lastMsg && lastMsg.role === "user") {
        lastMsg.content.push({
          type: "image" as const,
          image: imageUrl,
        } as never);
      }
    }

    // --- Send typing indicator ---
    await tg.sendChatAction(chatId);

    // --- Run Ruhi agent ---
    const result = await runRuhiAgent(aiMessages);
    const responseText = result.text || "Sorry, I could not generate a response. Please try again.";

    // --- Save assistant response to DB ---
    await saveMessage({
      conversationId: conversation.id,
      role: "assistant",
      content: responseText,
    });

    // --- Send response back to Telegram ---
    await tg.sendMessage(chatId, responseText);
  } catch (error) {
    console.error("[Telegram] Error processing update:", error);
    try {
      await tg.sendMessage(
        chatId,
        "Oops! Something went wrong. Please try again in a moment.",
      );
    } catch {
      // If we can't even send an error message, just log it
      console.error("[Telegram] Failed to send error message to user");
    }
  }
}

// ---- Command handlers ----

async function handleCommand(
  text: string,
  chatId: number,
  from: NonNullable<TelegramUpdate["message"]>["from"] & object,
  tg: TelegramClient,
): Promise<boolean> {
  const command = text.split(" ")[0].toLowerCase().replace(/@\w+$/, "");

  switch (command) {
    case "/start":
      await tg.sendMessage(
        chatId,
        `Hey ${from.first_name}! I'm Ruhi, your personal skincare didi.\n\n` +
          `Here's what I can do:\n` +
          `- Answer your skincare questions\n` +
          `- Analyze your skin from photos (just send me a selfie!)\n` +
          `- Track your menstrual cycle for better skin advice\n\n` +
          `Commands:\n` +
          `/scan — Send a photo for skin analysis\n` +
          `/cycle — Log or check your cycle info\n\n` +
          `Just type your question or send a photo to get started!`,
      );
      // Also upsert the user so they exist in the DB
      await upsertTelegramUser({
        telegramId: BigInt(from.id),
        username: from.username,
      });
      return true;

    case "/scan":
      await tg.sendMessage(
        chatId,
        "Send me a clear selfie and I'll analyze your skin! " +
          "Make sure you have good lighting and no filters.",
      );
      return true;

    case "/cycle":
      await tg.sendMessage(
        chatId,
        "Tell me about your cycle! You can say something like:\n" +
          `- "My period started today"\n` +
          `- "My last period was on March 15"\n` +
          `- "My cycle is usually 28 days"\n\n` +
          "I'll use this info to give you better skincare advice based on your hormonal phase.",
      );
      return true;

    default:
      // Unknown command — let it fall through to the agent
      return false;
  }
}
