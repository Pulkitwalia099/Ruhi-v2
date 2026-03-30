import { put } from "@vercel/blob";
import { generateText } from "ai";
import {
  clearTelegramHistory,
  getOnboarding,
  getTelegramHistory,
  saveTelegramMessage,
  upsertOnboarding,
  upsertTelegramUser,
} from "@/db/queries";
import { runRuhiAgent } from "@/lib/ai/agent";
import {
  analyzeProductPhoto,
  classifyPhotoIntent,
} from "@/lib/ai/analyze-product";
import { runScanPipeline } from "@/lib/ai/scan-pipeline";
import { transcribeAudio } from "@/lib/ai/transcribe";
import { loadAndFormatMemories } from "@/lib/memory/loader";
import { runPostHocSafetyNet } from "@/lib/memory/safety-net";
import { TelegramClient } from "./client";
import { handleOnboardingStep, resumeOnboarding } from "./onboarding";

// ------------------------------------------------
// src/lib/telegram/handler.ts
//
// Processes incoming Telegram updates: text, photos,
// and slash commands. Persists messages in our DB
// and runs the Ruhi agent for responses.
// ------------------------------------------------

// ---- Message splitting helpers ----

/** Pool of "thinking" messages sent before scan processing */
const SCAN_THINKING_MESSAGES = [
  "Hmm dekhti hoon...",
  "Ek second, check karti hoon...",
  "Photo dekh rahi hoon...",
  "Ruk, analyze karti hoon...",
  "Okay let me see...",
];

/**
 * Split an LLM response on `|||` delimiters and send each chunk
 * with a typing indicator and a natural delay in between.
 */
async function sendSplitMessages(
  tg: TelegramClient,
  chatId: number,
  text: string
) {
  const chunks = text
    .split("|||")
    .map((c) => c.trim())
    .filter(Boolean);

  for (let i = 0; i < chunks.length; i++) {
    // Show "typing..." before every chunk (including the first)
    await tg.sendChatAction(chatId);
    if (i > 0) {
      // Wait proportional to chunk length between messages
      const delay = Math.min(Math.max(chunks[i].length * 50, 800), 3000);
      await new Promise((r) => setTimeout(r, delay));
    }
    await tg.sendMessage(chatId, chunks[i]);
  }
}

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
    photo?: Array<{
      file_id: string;
      file_unique_id: string;
      width: number;
      height: number;
      file_size?: number;
    }>;
    caption?: string;
    voice?: {
      file_id: string;
      file_unique_id: string;
      duration: number;
      mime_type?: string;
      file_size?: number;
    };
    entities?: Array<{ type: string; offset: number; length: number }>;
  };
  callback_query?: {
    id: string;
    from: {
      id: number;
      is_bot: boolean;
      first_name: string;
      username?: string;
    };
    message?: {
      message_id: number;
      chat: { id: number; type: string };
    };
    data?: string;
  };
}

/**
 * Process a single Telegram update.
 * Called inside `after()` so the HTTP 200 has already been returned.
 */
export async function processTelegramUpdate(
  update: TelegramUpdate,
  botToken: string
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

  const tg = new TelegramClient(botToken);

  // --- Handle callback queries (inline keyboard taps) ---
  if (update.callback_query) {
    const cbq = update.callback_query;
    await tg.answerCallbackQuery(cbq.id);

    const chatId = cbq.message?.chat.id;
    const fromUser = cbq.from;
    if (chatId && fromUser && cbq.data) {
      try {
        const dbUser = await upsertTelegramUser({
          telegramId: BigInt(fromUser.id),
          username: fromUser.username,
        });
        const onboardingRow = await getOnboarding(dbUser.id);
        if (
          onboardingRow &&
          !["complete", "skipped"].includes(onboardingRow.state)
        ) {
          await handleOnboardingStep(tg, chatId, dbUser.id, onboardingRow, {
            type: "callback",
            data: cbq.data,
            messageId: cbq.message?.message_id,
          });
        }
      } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : String(error);
        console.error("[Telegram] Callback query error:", errMsg);
        try {
          await tg.sendMessage(
            chatId,
            "Sorry yaar, kuch problem ho gayi. Dobara try karo? 🙏"
          );
        } catch {
          // Can't reach user — just log
        }
      }
    }
    return;
  }

  const msg = update.message;
  if (!msg || !msg.from || msg.from.is_bot) return;

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

    // --- Transcribe voice notes to text ---
    let voiceTranscribedText: string | undefined;
    if (msg.voice) {
      try {
        console.log(
          "[Noor/TG] Voice note received, chat:",
          chatId,
          "duration:",
          msg.voice.duration,
          "s"
        );
        const voiceBuffer = await tg.downloadFile(msg.voice.file_id);
        console.log(
          "[Noor/TG] Voice note downloaded, size:",
          voiceBuffer.length,
          "bytes"
        );
        const transcribed = await transcribeAudio(
          voiceBuffer,
          msg.voice.mime_type ?? "audio/ogg"
        );
        if (transcribed) {
          console.log(
            "[Noor/TG] Transcription result:",
            transcribed.length,
            "chars"
          );
          voiceTranscribedText = transcribed;
        } else {
          await tg.sendMessage(
            chatId,
            "Yaar, voice note sun nahi payi. Dobara bhejo ya type kar do? 🎤"
          );
          return;
        }
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error("[Noor/TG] Voice transcription error:", errMsg);
        await tg.sendMessage(
          chatId,
          "Yaar, voice note sun nahi payi. Dobara bhejo ya type kar do? 🎤"
        );
        return;
      }
    }

    // --- Check mid-onboarding state ---
    const onboardingRow = await getOnboarding(dbUser.id);
    if (
      onboardingRow &&
      !["complete", "skipped"].includes(onboardingRow.state)
    ) {
      // User is mid-onboarding — delegate to onboarding controller
      const largestPhoto = msg.photo?.length
        ? msg.photo[msg.photo.length - 1]
        : undefined;
      await handleOnboardingStep(tg, chatId, dbUser.id, onboardingRow, {
        type: "message",
        text: voiceTranscribedText ?? msg.text ?? msg.caption ?? "",
        photo: largestPhoto ? { fileId: largestPhoto.file_id } : undefined,
      });
      return;
    }

    // --- Skipped user requests skin analysis → resume onboarding ---
    if (onboardingRow?.state === "skipped") {
      const userText = (
        voiceTranscribedText ??
        msg.text ??
        msg.caption ??
        ""
      ).toLowerCase();
      const wantsAnalysis =
        /\b(skin analysis|scan|analyze|selfie|analyse)\b/i.test(userText) ||
        (msg.photo && msg.photo.length > 0);
      if (wantsAnalysis) {
        await resumeOnboarding(tg, chatId, dbUser.id);
        return;
      }
    }

    // --- Build user content (text + optional photo) ---
    const userText = voiceTranscribedText ?? msg.text ?? msg.caption ?? "";
    let imageUrl: string | undefined;

    if (msg.photo && msg.photo.length > 0) {
      // ---- PHOTO PATH: Classify intent first, then route ----
      const largestPhoto = msg.photo[msg.photo.length - 1];
      const photoBuffer = await tg.downloadFile(largestPhoto.file_id);

      // Upload to Vercel Blob for permanent storage
      const blob = await put(
        `telegram-photos/${dbUser.id}/${Date.now()}.jpg`,
        photoBuffer,
        { access: "public", contentType: "image/jpeg" }
      );

      // Send immediate "thinking" message so user doesn't stare at nothing
      const thinkingMsg =
        SCAN_THINKING_MESSAGES[
          Math.floor(Math.random() * SCAN_THINKING_MESSAGES.length)
        ];
      await tg.sendMessage(chatId, thinkingMsg);
      await tg.sendChatAction(chatId);

      // Classify using image + text context (caption + recent chat)
      const recentMsgs = await getTelegramHistory({
        telegramChatId: chatId,
        limit: 6,
      });
      const recentContext = recentMsgs
        .slice(-6)
        .map((m) => `${m.role}: ${m.content.substring(0, 100)}`)
        .join("\n");
      const intent = await classifyPhotoIntent(photoBuffer, {
        caption: userText || undefined,
        recentMessages: recentContext || undefined,
      });
      console.log(
        "[Noor] Photo intent:",
        intent,
        "for chat",
        chatId,
        "caption:",
        userText?.substring(0, 30)
      );

      if (intent === "product") {
        // ---- PRODUCT PATH: Analyze ingredients ----
        const productMemories = await loadAndFormatMemories(dbUser.id);
        const analysis = await analyzeProductPhoto(
          photoBuffer,
          dbUser.id,
          productMemories ?? undefined
        );

        await saveTelegramMessage({
          telegramChatId: chatId,
          role: "user",
          content: userText || "Sent a product photo for analysis",
        });
        await saveTelegramMessage({
          telegramChatId: chatId,
          role: "assistant",
          content: analysis,
        });
        await sendSplitMessages(tg, chatId, analysis);
        return;
      }

      // ---- SELFIE PATH: Existing scan pipeline ----
      const imageBase64 = photoBuffer.toString("base64");

      // Step 1: Shared scan pipeline — Gemini Vision analysis + DB save + comparison
      const { scanResult, scanId, comparisonBlock, cycleContext } =
        await runScanPipeline({
          imageData: imageBase64,
          userId: dbUser.id,
          imageUrl: blob.url,
        });

      // Step 2: Noor (Claude) interprets the raw scan in her voice
      let responseText: string;
      if (scanResult) {
        const scanData = JSON.stringify(scanResult, null, 2);
        const { buildRuhiSystemPrompt } = await import("@/lib/ai/prompts");
        const { getLanguageModel } = await import("@/lib/ai/providers");
        const { DEFAULT_CHAT_MODEL } = await import("@/lib/ai/models");

        // Load memories for photo interpretation too
        const photoMemoriesBlock = await loadAndFormatMemories(dbUser.id);

        const interpretation = await generateText({
          model: getLanguageModel(DEFAULT_CHAT_MODEL),
          system: buildRuhiSystemPrompt(
            cycleContext,
            photoMemoriesBlock ?? undefined
          ),
          messages: [
            {
              role: "user",
              content: `Here are my skin scan results. Interpret them for me in your style — what's good, what needs attention, and what should I do:\n\n${scanData}${comparisonBlock}`,
            },
          ],
        });

        responseText =
          interpretation.text ||
          "Scan ho gaya, but summary generate nahi ho payi. Thodi der mein try karo.";
      } else {
        responseText =
          "Sorry yaar, photo analyze nahi ho payi. Clear selfie bhejo with good lighting!";
      }

      // Save scan conversation to simple telegram_messages table
      await saveTelegramMessage({
        telegramChatId: chatId,
        role: "user",
        content: userText || "Sent a selfie for skin analysis",
      });
      await saveTelegramMessage({
        telegramChatId: chatId,
        role: "assistant",
        content: responseText,
      });
      await sendSplitMessages(tg, chatId, responseText);

      // Step 3: Send report card image if scan succeeded
      if (scanId && scanResult) {
        try {
          console.log("[Noor] Generating report card for scan:", scanId);
          const { buildReportCardResponse } = await import(
            "@/lib/report/skin-report"
          );
          console.log("[Noor] buildReportCardResponse imported successfully");
          const imageResponse = buildReportCardResponse(scanResult, new Date());
          console.log("[Noor] ImageResponse created, converting to buffer...");
          const reportBuffer = Buffer.from(await imageResponse.arrayBuffer());
          console.log(
            "[Noor] Report card buffer size:",
            reportBuffer.length,
            "bytes"
          );
          await tg.sendPhoto(
            chatId,
            reportBuffer,
            "Your Skin Analysis Report by meetSakhi.com ✨"
          );
          console.log("[Noor] Report card sent successfully to chat:", chatId);
        } catch (reportErr: any) {
          console.error(
            "[Noor] Report card FAILED:",
            reportErr?.message || reportErr
          );
          console.error("[Noor] Report card stack:", reportErr?.stack);
        }
      } else {
        console.log(
          "[Noor] Skipping report card — scanId:",
          scanId,
          "scanResult:",
          !!scanResult
        );
      }

      return;
    }

    // ---- TEXT PATH: Use Ruhi agent ----

    // Save user message (plain text — no JSON parts)
    await saveTelegramMessage({
      telegramChatId: chatId,
      role: "user",
      content: userText,
    });

    // Load user memories for system prompt injection
    const memoriesBlock = await loadAndFormatMemories(dbUser.id);

    // Load conversation history — last 40 messages (20 exchanges)
    // Larger window prevents Ruhi from forgetting things said earlier in long conversations
    const history = await getTelegramHistory({
      telegramChatId: chatId,
      limit: 40,
    });

    // Filter out any error messages that got saved previously
    const aiMessages = history
      .filter(
        (m) =>
          !m.content.includes("problem ho rahi hai") &&
          !m.content.includes("Something went wrong")
      )
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

    console.log(
      "[Ruhi] Chat",
      chatId,
      "— sending",
      aiMessages.length,
      "messages. Last:",
      JSON.stringify(
        aiMessages[aiMessages.length - 1]?.content?.substring(0, 50)
      )
    );

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
    if (
      cleanMessages.length > 0 &&
      cleanMessages[cleanMessages.length - 1].role !== "user"
    ) {
      // Current user message got merged or lost — add it back
      cleanMessages.push({ role: "user", content: userText });
    }

    console.log(
      "[Ruhi] After cleanup:",
      cleanMessages.length,
      "messages. First:",
      cleanMessages[0]?.role,
      "Last:",
      cleanMessages[cleanMessages.length - 1]?.role
    );

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
      responseText =
        "Sorry yaar, abhi kuch problem ho rahi hai. Thodi der mein dobara try karo?";
    }

    // Only save successful responses — never save error messages to DB
    if (agentSucceeded) {
      await saveTelegramMessage({
        telegramChatId: chatId,
        role: "assistant",
        content: responseText,
      });
    }

    // Post-hoc safety net: catch critical identity facts the LLM may have missed
    runPostHocSafetyNet(dbUser.id, userText).catch((err) =>
      console.error("[SafetyNet] Unhandled:", err)
    );

    // Natural language opt-out detection for proactive messages
    detectProactiveOptOut(dbUser.id, userText).catch((err) =>
      console.error("[OptOut] Unhandled:", err)
    );

    // Send response back to Telegram (split on ||| for natural pacing)
    await sendSplitMessages(tg, chatId, responseText);
  } catch (error: any) {
    const errDetail = error?.message || String(error);
    console.error("[Telegram] OUTER ERROR:", errDetail);
    try {
      await tg.sendMessage(
        chatId,
        "Oops! Something went wrong. Please try again in a moment."
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
  tg: TelegramClient
): Promise<boolean> {
  const command = text.split(" ")[0].toLowerCase().replace(/@\w+$/, "");

  switch (command) {
    case "/start": {
      // Clear conversation history for a fresh start
      await clearTelegramHistory({ telegramChatId: chatId });
      const startUser = await upsertTelegramUser({
        telegramId: BigInt(from.id),
        username: from.username,
      });

      // Check onboarding status
      const existingOnboarding = await getOnboarding(startUser.id);

      if (existingOnboarding?.state === "complete") {
        // Already onboarded — send a shorter welcome back
        await tg.sendMessage(
          chatId,
          `Hey ${from.first_name}! Welcome back 💕\n\n` +
            "Photo bhejo for skin analysis, ya kuch bhi poocho!\n" +
            "/scan — skin analysis\n" +
            "/cycle — cycle info"
        );
      } else {
        // Start (or restart) onboarding
        await upsertOnboarding({
          userId: startUser.id,
          state: "awaiting_intent",
          answers: {},
        });
        await handleOnboardingStep(
          tg,
          chatId,
          startUser.id,
          {
            state: "awaiting_intent",
            answers: {},
          },
          { type: "start" }
        );
      }
      return true;
    }

    case "/scan":
      await tg.sendMessage(
        chatId,
        "Send me a clear selfie and I'll analyze your skin! " +
          "Make sure you have good lighting and no filters."
      );
      return true;

    case "/cycle":
      await tg.sendMessage(
        chatId,
        "Tell me about your cycle! You can say something like:\n" +
          `- "My period started today"\n` +
          `- "My last period was on March 15"\n` +
          `- "My cycle is usually 28 days"\n\n` +
          "I'll use this info to give you better skincare advice based on your hormonal phase."
      );
      return true;

    case "/quiet":
      // Pause proactive messages
      await upsertProactivePreference(from.id, "paused");
      await tg.sendMessage(
        chatId,
        "Okay, mein khud se message nahi karungi ab. Jab chahiye ho toh /nudge bhej dena!"
      );
      return true;

    case "/nudge":
      // Resume proactive messages
      await upsertProactivePreference(from.id, "active");
      await tg.sendMessage(
        chatId,
        "Done! Ab mein check-in karungi — product follow-ups, scan reminders, weather tips. 🙌"
      );
      return true;

    case "/link": {
      const linkCodeStr = text.split(" ")[1]?.trim().toUpperCase();
      if (!linkCodeStr) {
        await tg.sendMessage(
          chatId,
          "Code bhejo! Example: /link ABC123\n\nWeb pe jaake code generate karo: ruhi-v2.vercel.app/link-telegram"
        );
        return true;
      }

      const { findValidLinkCode, markLinkCodeUsed } = await import(
        "@/db/queries"
      );
      const { linkAccounts } = await import("@/lib/account/link-accounts");

      const codeRecord = await findValidLinkCode({ code: linkCodeStr });
      if (!codeRecord) {
        await tg.sendMessage(
          chatId,
          "Yeh code valid nahi hai ya expire ho gaya. Web pe naya code generate karo: ruhi-v2.vercel.app/link-telegram"
        );
        return true;
      }

      // Get or create the Telegram user
      const telegramUser = await upsertTelegramUser({
        telegramId: BigInt(from.id),
        username: from.username,
      });

      // Check if already the same user
      if (telegramUser.id === codeRecord.userId) {
        await tg.sendMessage(chatId, "Yeh account already linked hai!");
        return true;
      }

      try {
        await linkAccounts(codeRecord.userId, telegramUser.id, BigInt(from.id));
        await markLinkCodeUsed({ id: codeRecord.id });
        await tg.sendMessage(
          chatId,
          "Account linked! Ab web aur Telegram dono pe same data milega. Memories, scans, sab ek jagah!"
        );
      } catch (err) {
        console.error("[Link] Account linking failed:", err);
        await tg.sendMessage(
          chatId,
          "Sorry, linking mein kuch problem ho gayi. Thodi der mein try karo."
        );
      }
      return true;
    }

    default:
      // Unknown command — let it fall through to the agent
      return false;
  }
}

/** Detect natural language opt-out for proactive messages */
async function detectProactiveOptOut(userId: string, text: string) {
  const optOutPatterns =
    /(?:stop messaging|stop texting|don'?t message|don'?t text|mat bhej|band kar|message mat kar|msg mat kar|stop sending|leave me alone)/i;
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
  value: "active" | "paused"
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
