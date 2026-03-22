import { put } from "@vercel/blob";
import { generateText, Output } from "ai";
import { z } from "zod";

import { runRuhiAgent } from "@/lib/ai/agent";
import { getLanguageModel } from "@/lib/ai/providers";
import { VISION_MODEL } from "@/lib/ai/models";
import { calculateCyclePhase } from "@/lib/ai/tools/cycle-utils";
import { loadAndFormatMemories } from "@/lib/memory/loader";
import { runPostHocSafetyNet } from "@/lib/memory/safety-net";
import {
  getLatestCycle,
  getRecentScans,
  insertScan,
  upsertTelegramUser,
  saveTelegramMessage,
  getTelegramHistory,
  clearTelegramHistory,
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

    // --- Upsert user ---
    const dbUser = await upsertTelegramUser({
      telegramId: BigInt(msg.from.id),
      username: msg.from.username,
    });

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

      // Step 1: Gemini does RAW clinical analysis (no personality, just facts)
      const scanSchema = z.object({
        zones: z.object({
          forehead: z.object({ condition: z.string(), severity: z.number(), clinical_notes: z.string() }),
          t_zone: z.object({ condition: z.string(), severity: z.number(), clinical_notes: z.string() }),
          left_cheek: z.object({ condition: z.string(), severity: z.number(), clinical_notes: z.string() }),
          right_cheek: z.object({ condition: z.string(), severity: z.number(), clinical_notes: z.string() }),
          chin: z.object({ condition: z.string(), severity: z.number(), clinical_notes: z.string() }),
          jawline: z.object({ condition: z.string(), severity: z.number(), clinical_notes: z.string() }),
        }),
        overall_score: z.number(),
        key_concerns: z.array(z.string()),
        positives: z.array(z.string()),
      });

      const scanResult = await generateText({
        model: getLanguageModel(VISION_MODEL),
        output: Output.object({ schema: scanSchema }),
        messages: [{
          role: "user",
          content: [
            {
              type: "text",
              text: `You are a clinical dermatology AI. Analyze this selfie objectively across 6 facial zones: forehead, t_zone, left_cheek, right_cheek, chin, jawline.

For each zone provide:
- condition: clinical observation (acne, dryness, oiliness, clear, texture issues, hyperpigmentation, etc.)
- severity: 1-10 where 10 = perfectly healthy skin, 1 = severe concern
- clinical_notes: brief clinical assessment
${cycleContext}${historyContext}

Also provide:
- overall_score: 1-10 (10 = excellent skin health)
- key_concerns: array of top 2-3 issues found
- positives: array of things that look good

Be precise and clinical. No personality or emotion — just facts.`,
            },
            { type: "image", image: imageBase64 },
          ],
        }],
      });

      // Save raw scan to DB
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

      // Step 2: Ruhi (Claude) interprets the raw scan in her voice
      let responseText: string;
      if (scanResult.output) {
        const scanData = JSON.stringify(scanResult.output, null, 2);
        const { buildRuhiSystemPrompt } = await import("@/lib/ai/prompts");
        const { getLanguageModel } = await import("@/lib/ai/providers");
        const { DEFAULT_CHAT_MODEL } = await import("@/lib/ai/models");

        // Load memories for photo interpretation too
        const photoMemoriesBlock = await loadAndFormatMemories(dbUser.id);

        const interpretation = await generateText({
          model: getLanguageModel(DEFAULT_CHAT_MODEL),
          system: buildRuhiSystemPrompt(cycleContext, photoMemoriesBlock ?? undefined),
          messages: [{
            role: "user",
            content: `Here are my skin scan results. Interpret them for me in your style — what's good, what needs attention, and what should I do:\n\n${scanData}`,
          }],
        });

        responseText = interpretation.text || "Scan ho gaya, but summary generate nahi ho payi. Thodi der mein try karo.";
      } else {
        responseText = "Sorry yaar, photo analyze nahi ho payi. Clear selfie bhejo with good lighting!";
      }

      // Save scan conversation to simple telegram_messages table
      await saveTelegramMessage({ telegramChatId: chatId, role: "user", content: userText || "Sent a selfie for skin analysis" });
      await saveTelegramMessage({ telegramChatId: chatId, role: "assistant", content: responseText });
      await tg.sendMessage(chatId, responseText);
      return;
    }

    // ---- TEXT PATH: Use Ruhi agent ----

    // Save user message (plain text — no JSON parts)
    await saveTelegramMessage({ telegramChatId: chatId, role: "user", content: userText });

    // Load user memories for system prompt injection
    const memoriesBlock = await loadAndFormatMemories(dbUser.id);

    // Load conversation history — last 40 messages (20 exchanges)
    // Larger window prevents Ruhi from forgetting things said earlier in long conversations
    const history = await getTelegramHistory({ telegramChatId: chatId, limit: 40 });

    // Filter out any error messages that got saved previously
    const aiMessages = history
      .filter((m) => !m.content.includes("problem ho rahi hai") && !m.content.includes("Something went wrong"))
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

    console.log("[Ruhi] Chat", chatId, "— sending", aiMessages.length, "messages. Last:", JSON.stringify(aiMessages[aiMessages.length - 1]?.content?.substring(0, 50)));

    // Validate messages — ensure proper user/assistant alternation
    const validMessages: typeof aiMessages = [];
    for (const msg of aiMessages) {
      if (msg.content && msg.content.trim().length > 0) {
        validMessages.push(msg);
      }
    }

    // Ensure first message is from user (Anthropic requirement)
    if (validMessages.length > 0 && validMessages[0].role !== "user") {
      validMessages.shift();
    }

    // Ensure alternating roles (Anthropic requirement)
    const cleanMessages: typeof aiMessages = [];
    for (const msg of validMessages) {
      const last = cleanMessages[cleanMessages.length - 1];
      if (last && last.role === msg.role) {
        // Same role twice — merge content
        last.content += "\n" + msg.content;
      } else {
        cleanMessages.push({ ...msg });
      }
    }

    // Ensure last message is from user (Anthropic requirement)
    if (cleanMessages.length > 0 && cleanMessages[cleanMessages.length - 1].role !== "user") {
      // Current user message got merged or lost — add it back
      cleanMessages.push({ role: "user", content: userText });
    }

    console.log("[Ruhi] After cleanup:", cleanMessages.length, "messages. First:", cleanMessages[0]?.role, "Last:", cleanMessages[cleanMessages.length - 1]?.role);

    // Send typing indicator
    await tg.sendChatAction(chatId);

    // Run Ruhi agent (with userId for cycle tools)
    let responseText: string;
    let agentSucceeded = false;
    try {
      const result = await runRuhiAgent(cleanMessages, {
        userId: dbUser.id,
        memoriesBlock: memoriesBlock ?? undefined,
      });
      responseText = result.text || "";
      console.log("[Ruhi] Agent response length:", responseText.length);
      if (responseText) agentSucceeded = true;
    } catch (agentError: any) {
      const errMsg = agentError?.message || String(agentError);
      console.error("[Ruhi] Agent FAILED:", errMsg);
      responseText = "";
    }

    if (!responseText) {
      responseText = "Sorry yaar, abhi kuch problem ho rahi hai. Thodi der mein dobara try karo?";
    }

    // Only save successful responses — never save error messages to DB
    if (agentSucceeded) {
      await saveTelegramMessage({ telegramChatId: chatId, role: "assistant", content: responseText });
    }

    // Post-hoc safety net: catch critical identity facts the LLM may have missed
    runPostHocSafetyNet(dbUser.id, userText).catch((err) =>
      console.error("[SafetyNet] Unhandled:", err),
    );

    // Natural language opt-out detection for proactive messages
    detectProactiveOptOut(dbUser.id, userText).catch((err) =>
      console.error("[OptOut] Unhandled:", err),
    );

    // Send response back to Telegram
    await tg.sendMessage(chatId, responseText);
  } catch (error: any) {
    const errDetail = error?.message || String(error);
    console.error("[Telegram] OUTER ERROR:", errDetail);
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
      // Clear conversation history for a fresh start
      await clearTelegramHistory({ telegramChatId: chatId });
      await tg.sendMessage(
        chatId,
        `Hey ${from.first_name}! Main Ruhi hoon — your skincare companion.\n\n` +
          `Kya kar sakti hoon:\n` +
          `- Skincare questions ka jawab\n` +
          `- Selfie se skin analysis (bas photo bhejo!)\n` +
          `- Cycle track karke better skin advice\n\n` +
          `/scan — photo se skin analysis\n` +
          `/cycle — cycle info log karo\n\n` +
          `Bolo kya scene hai!`,
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

    case "/quiet":
      // Pause proactive messages
      await upsertProactivePreference(from.id, "paused");
      await tg.sendMessage(
        chatId,
        "Okay, mein khud se message nahi karungi ab. Jab chahiye ho toh /nudge bhej dena!",
      );
      return true;

    case "/nudge":
      // Resume proactive messages
      await upsertProactivePreference(from.id, "active");
      await tg.sendMessage(
        chatId,
        "Done! Ab mein check-in karungi — product follow-ups, scan reminders, weather tips. 🙌",
      );
      return true;

    default:
      // Unknown command — let it fall through to the agent
      return false;
  }
}

/** Detect natural language opt-out for proactive messages */
async function detectProactiveOptOut(userId: string, text: string) {
  const optOutPatterns = /(?:stop messaging|stop texting|don'?t message|don'?t text|mat bhej|band kar|message mat kar|msg mat kar|stop sending|leave me alone)/i;
  if (!optOutPatterns.test(text)) return;

  const { upsertMemory } = await import("@/db/queries");
  await upsertMemory({
    userId,
    category: "preference",
    key: "proactive",
    value: "paused",
  });
  console.log("[OptOut] Natural language opt-out detected for user:", userId);
}

/** Helper to set proactive preference via upsertMemory */
async function upsertProactivePreference(
  telegramFromId: number,
  value: "active" | "paused",
) {
  const dbUser = await upsertTelegramUser({
    telegramId: BigInt(telegramFromId),
  });
  const { upsertMemory } = await import("@/db/queries");
  await upsertMemory({
    userId: dbUser.id,
    category: "preference",
    key: "proactive",
    value,
  });
}
