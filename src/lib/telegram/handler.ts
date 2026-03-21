import { put } from "@vercel/blob";
import { generateText, Output } from "ai";
import { z } from "zod";

import { runRuhiAgent } from "@/lib/ai/agent";
import { getLanguageModel } from "@/lib/ai/providers";
import { VISION_MODEL } from "@/lib/ai/models";
import { calculateCyclePhase } from "@/lib/ai/tools/cycle-utils";
import {
  getLatestCycle,
  getRecentScans,
  insertScan,
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
      // ---- PHOTO PATH: Call Gemini Vision directly ----
      const largestPhoto = msg.photo[msg.photo.length - 1];
      const photoBuffer = await tg.downloadFile(largestPhoto.file_id);

      // Upload to Vercel Blob for permanent storage
      const blob = await put(
        `telegram-photos/${dbUser.id}/${Date.now()}.jpg`,
        photoBuffer,
        { access: "public", contentType: "image/jpeg" },
      );

      await tg.sendChatAction(chatId);

      // Get cycle context for the scan
      let cycleContext = "";
      let cycleDay: number | undefined;
      let cyclePhase: string | undefined;
      const cycle = await getLatestCycle({ userId: dbUser.id });
      if (cycle) {
        const phase = calculateCyclePhase(cycle.periodStart, cycle.cycleLength);
        cycleDay = phase.cycleDay;
        cyclePhase = phase.phase;
        cycleContext = `\nCycle context: Day ${phase.cycleDay}, ${phase.phase} phase. ${phase.skinImplications}`;
      }

      // Get recent scan history
      const recentScans = await getRecentScans({ userId: dbUser.id, limit: 3 });
      let historyContext = "";
      if (recentScans.length > 0) {
        historyContext = `\nPrevious scans:\n${JSON.stringify(
          recentScans.map((s) => ({
            date: s.createdAt.toISOString().split("T")[0],
            results: s.results,
          })), null, 2)}`;
      }

      const imageBase64 = photoBuffer.toString("base64");

      // Call Gemini Vision directly
      const scanSchema = z.object({
        zones: z.object({
          forehead: z.object({ condition: z.string(), severity: z.number(), notes: z.string() }),
          t_zone: z.object({ condition: z.string(), severity: z.number(), notes: z.string() }),
          left_cheek: z.object({ condition: z.string(), severity: z.number(), notes: z.string() }),
          right_cheek: z.object({ condition: z.string(), severity: z.number(), notes: z.string() }),
          chin: z.object({ condition: z.string(), severity: z.number(), notes: z.string() }),
          jawline: z.object({ condition: z.string(), severity: z.number(), notes: z.string() }),
        }),
        overall_score: z.number(),
        summary: z.string(),
      });

      const scanResult = await generateText({
        model: getLanguageModel(VISION_MODEL),
        output: Output.object({ schema: scanSchema }),
        messages: [{
          role: "user",
          content: [
            {
              type: "text",
              text: `You are a dermatology-trained skin analysis AI. Analyze this selfie for skin conditions across 6 facial zones: forehead, t_zone, left_cheek, right_cheek, chin, jawline.\n\nFor each zone:\n- condition: what you observe\n- severity: 1-10 (1=perfect, 10=severe)\n- notes: observation + advice${cycleContext}${historyContext}\n\nProvide overall_score (1-10) and a friendly summary in Hinglish.`,
            },
            { type: "image", image: imageBase64 },
          ],
        }],
      });

      // Save scan to DB
      if (scanResult.output) {
        await insertScan({
          userId: dbUser.id,
          imageUrl: blob.url,
          scanType: "face",
          results: scanResult.output as Record<string, unknown>,
          cycleDay,
          cyclePhase,
        });
      }

      // Format response from scan results
      let responseText: string;
      if (scanResult.output) {
        const scan = scanResult.output as z.infer<typeof scanSchema>;
        responseText = scan.summary;
        responseText += `\n\n📊 Overall Score: ${scan.overall_score}/10`;
        responseText += `\n\nZone Details:`;
        for (const [zone, data] of Object.entries(scan.zones)) {
          responseText += `\n• ${zone.replace("_", " ")}: ${data.condition} (${data.severity}/10) — ${data.notes}`;
        }
      } else {
        responseText = "Sorry yaar, photo analyze nahi ho payi. Clear selfie bhejo with good lighting!";
      }

      await saveMessage({ conversationId: conversation.id, role: "user", content: userText || "Sent a selfie for skin analysis" });
      await saveMessage({ conversationId: conversation.id, role: "assistant", content: responseText });
      await tg.sendMessage(chatId, responseText);
      return;
    }

    // ---- TEXT PATH: Use Ruhi agent ----

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
        content: textContent,
      };
    });

    // --- Send typing indicator ---
    await tg.sendChatAction(chatId);

    // --- Run Ruhi agent ---
    const result = await runRuhiAgent(aiMessages);
    const responseText = result.text || "Sorry yaar, kuch samajh nahi aaya. Dobara try kar?";

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
