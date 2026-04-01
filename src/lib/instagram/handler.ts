import { put } from "@vercel/blob";
import { generateText } from "ai";
import {
  checkInstagramMessageExists,
  getInstagramHistory,
  getOnboarding,
  saveInstagramMessage,
  upsertInstagramUser,
  upsertOnboarding,
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
import {
  formatOptionsText,
  INTENT_OPTIONS,
  toQuickReplies,
} from "@/lib/onboarding/questions";
import { InstagramClient } from "./client";
import {
  handleInstagramOnboarding,
  handleOnboardingPhotoSkip,
  handleOnboardingReply,
} from "./onboarding";
import { sendSplitMessages } from "./utils";

// ------------------------------------------------
// src/lib/instagram/handler.ts
//
// Processes incoming Instagram DM webhooks: text and
// photo messages. Includes scan-first onboarding flow
// for first-time users (progressive personalization).
// ------------------------------------------------

/** Pool of "thinking" messages sent before scan processing */
const SCAN_THINKING_MESSAGES = [
  "Hmm dekhti hoon...",
  "Ek second, check karti hoon...",
  "Photo dekh rahi hoon...",
  "Ruk, analyze karti hoon...",
  "Okay let me see...",
];

/**
 * Instagram webhook messaging entry shape.
 * Each webhook POST has body.entry[].messaging[] with these objects.
 */
export interface InstagramMessagingEntry {
  sender: { id: string };
  recipient: { id: string };
  timestamp: number;
  message?: {
    mid: string;
    text?: string;
    is_echo?: boolean;
    quick_reply?: { payload: string };
    attachments?: Array<{
      type: string; // "image", "video", "audio", "file"
      payload: { url: string };
    }>;
  };
}

/**
 * Process a single Instagram messaging entry.
 * Called inside `after()` so the HTTP 200 has already been returned.
 */
export async function processInstagramMessage(
  entry: InstagramMessagingEntry,
  pageAccessToken: string,
  pageId: string
) {
  const msg = entry.message;
  if (!msg) return;

  // Skip echo messages (our own bot replies)
  if (msg.is_echo) return;

  // Idempotency: skip duplicate messages (DB-based, works across instances)
  const alreadyProcessed = await checkInstagramMessageExists(entry.sender.id);
  if (alreadyProcessed) return;

  const senderId = entry.sender.id;
  const ig = new InstagramClient(pageAccessToken, pageId);

  try {
    // Upsert user
    const dbUser = await upsertInstagramUser({ instagramId: senderId });

    // Check for image attachments
    const imageAttachment = msg.attachments?.find((a) => a.type === "image");

    if (imageAttachment) {
      // ---- PHOTO PATH ----
      await handlePhotoMessage(
        ig,
        senderId,
        dbUser,
        imageAttachment.payload.url,
        msg.text
      );
      return;
    }

    // Check for audio attachments (voice notes)
    const audioAttachment = msg.attachments?.find((a) => a.type === "audio");
    if (audioAttachment) {
      // ---- VOICE NOTE PATH ----
      await ig.sendTypingIndicator(senderId);
      try {
        console.log(
          "[Noor/IG] Voice note received from:",
          senderId,
          "url:",
          audioAttachment.payload.url.substring(0, 60)
        );
        const audioBuffer = await ig.downloadImage(audioAttachment.payload.url);
        console.log(
          "[Noor/IG] Voice note downloaded, size:",
          audioBuffer.length,
          "bytes"
        );
        const transcribedText = await transcribeAudio(audioBuffer, "audio/mp4");
        if (transcribedText) {
          console.log(
            "[Noor/IG] Transcription result:",
            transcribedText.length,
            "chars"
          );
          await handleTextMessage(ig, senderId, dbUser, transcribedText);
          return;
        }
      } catch (err: any) {
        console.error(
          "[Noor/IG] Voice transcription error:",
          err?.message || err
        );
      }
      // Transcription failed or returned null
      await ig.sendMessage(
        senderId,
        "Yaar, voice note sun nahi payi. Dobara bhejo ya type kar do? 🎤"
      );
      return;
    }

    if (msg.text) {
      // ---- TEXT PATH ----
      // Quick Reply taps send both text (button title with emoji) and payload.
      // Use payload preferentially since parsers expect it (e.g., "TYPE_combination").
      const userText = msg.quick_reply?.payload ?? msg.text;
      await handleTextMessage(ig, senderId, dbUser, userText);
      return;
    }

    // Unsupported message type (video, sticker, etc.)
    await ig.sendMessage(
      senderId,
      "Hey! Abhi mein sirf text, photos aur voice notes handle kar sakti hoon. Photo bhejo for skin analysis ya text mein kuch bhi poocho!"
    );
  } catch (error: any) {
    const errDetail = error?.message || String(error);
    console.error("[Instagram] OUTER ERROR:", errDetail);
    try {
      await ig.sendMessage(
        senderId,
        "Sorry yaar, kuch problem ho gayi. Thodi der mein try karo? 🙏"
      );
    } catch {
      console.error("[Instagram] Failed to send error message to user");
    }
  }
}

// ---- Photo handling ----

async function handlePhotoMessage(
  ig: InstagramClient,
  senderId: string,
  dbUser: { id: string },
  imageUrl: string,
  caption?: string
) {
  const userText = caption ?? "";

  // Download image from Instagram CDN
  const photoBuffer = await ig.downloadImage(imageUrl);

  // Upload to Vercel Blob for permanent storage
  const blob = await put(
    `instagram-photos/${dbUser.id}/${Date.now()}.jpg`,
    photoBuffer,
    { access: "public", contentType: "image/jpeg" }
  );

  // Send "thinking" message
  const thinkingMsg =
    SCAN_THINKING_MESSAGES[
      Math.floor(Math.random() * SCAN_THINKING_MESSAGES.length)
    ];
  await ig.sendMessage(senderId, thinkingMsg);
  await ig.sendTypingIndicator(senderId);

  // Check onboarding status early (needed by both product and selfie paths)
  const onboardingRow = await getOnboarding(dbUser.id);
  const onboardingState = onboardingRow?.state ?? null;

  // Prevent double processing: if already generating a profile, skip this photo
  if (onboardingState === "ig_generating_profile") {
    console.log(
      "[Noor/IG] Skipping photo — already generating profile for user:",
      senderId
    );
    return;
  }

  // Classify: selfie or product?
  const recentMsgs = await getInstagramHistory({
    instagramSenderId: senderId,
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
    "[Noor/IG] Photo intent:",
    intent,
    "for user",
    senderId,
    "caption:",
    userText?.substring(0, 30)
  );

  if (intent === "product") {
    // ---- PRODUCT PATH ----
    const productMemories = await loadAndFormatMemories(dbUser.id);
    const analysis = await analyzeProductPhoto(
      photoBuffer,
      dbUser.id,
      productMemories ?? undefined
    );

    await saveInstagramMessage({
      instagramSenderId: senderId,
      role: "user",
      content: userText || "Sent a product photo for analysis",
    });
    await saveInstagramMessage({
      instagramSenderId: senderId,
      role: "assistant",
      content: analysis,
    });
    await ig.sendTypingIndicator(senderId);
    await sendSplitMessages(ig, senderId, analysis);

    // H3: If mid-onboarding awaiting selfie, re-prompt after product check
    if (onboardingState === "ig_awaiting_selfie") {
      await new Promise((r) => setTimeout(r, 1000));
      await ig.sendMessage(
        senderId,
        "Product check done! Ab selfie bhi bhej do for skin analysis 📸"
      );
    }
    return;
  }

  // ---- SELFIE PATH ----

  // Explicit, mutually exclusive onboarding checks
  const isMidOnboarding =
    onboardingState !== null && onboardingState.startsWith("ig_awaiting");
  const isGenerating = onboardingState === "ig_generating_profile";
  const isComplete =
    onboardingState === "complete" || onboardingState === "skipped";
  const isFirstScan = !isComplete && !isMidOnboarding && !isGenerating;

  const imageBase64 = photoBuffer.toString("base64");

  // A6: Scan pipeline with timeout
  const SCAN_TIMEOUT_MS = 50_000;
  let scanPipelineResult;
  try {
    scanPipelineResult = await Promise.race([
      runScanPipeline({
        imageData: imageBase64,
        userId: dbUser.id,
        imageUrl: blob.url,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("SCAN_TIMEOUT")), SCAN_TIMEOUT_MS)
      ),
    ]);
  } catch (err: any) {
    if (err?.message === "SCAN_TIMEOUT") {
      await ig.sendMessage(
        senderId,
        "Yaar processing mein thoda time lag raha hai, ek aur baar try karo? 📸"
      );
      return;
    }
    throw err;
  }
  const { scanResult, scanId, comparisonBlock, cycleContext } =
    scanPipelineResult;

  // A4: User sent selfie while in awaiting_selfie -> skip straight to card generation
  // (questions were already answered during text-based onboarding)
  if (onboardingState === "ig_awaiting_selfie" && scanResult && scanId) {
    await saveInstagramMessage({
      instagramSenderId: senderId,
      role: "user",
      content: userText || "Sent a selfie for skin analysis",
    });
    const { handleSelfieAfterQuestions } = await import("./onboarding");
    await handleSelfieAfterQuestions(
      ig,
      senderId,
      dbUser.id,
      scanResult,
      scanId,
      blob.url,
      cycleContext,
      comparisonBlock
    );
    return;
  }

  // First-time selfie → enter onboarding flow
  if (isFirstScan && !isMidOnboarding && scanResult && scanId) {
    await saveInstagramMessage({
      instagramSenderId: senderId,
      role: "user",
      content: userText || "Sent a selfie for skin analysis",
    });
    await handleInstagramOnboarding(
      ig,
      senderId,
      dbUser.id,
      (dbUser as any).instagramUsername ?? undefined,
      scanResult,
      scanId,
      blob.url,
      cycleContext,
      comparisonBlock
    );
    return;
  }

  // Mid-onboarding photo → skip remaining questions, generate card with defaults
  if (isMidOnboarding && scanResult && scanId) {
    await saveInstagramMessage({
      instagramSenderId: senderId,
      role: "user",
      content: userText || "Sent another selfie during onboarding",
    });
    await handleOnboardingPhotoSkip(
      ig,
      senderId,
      dbUser.id,
      scanResult,
      scanId,
      blob.url,
      cycleContext,
      comparisonBlock
    );
    return;
  }

  // ---- REGULAR SCAN (onboarding already complete) ----
  let responseText: string;
  if (scanResult) {
    const scanData = JSON.stringify(scanResult, null, 2);
    const { buildRuhiSystemPrompt } = await import("@/lib/ai/prompts");
    const { getLanguageModel } = await import("@/lib/ai/providers");
    const { DEFAULT_CHAT_MODEL } = await import("@/lib/ai/models");

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

  await saveInstagramMessage({
    instagramSenderId: senderId,
    role: "user",
    content: userText || "Sent a selfie for skin analysis",
  });
  await saveInstagramMessage({
    instagramSenderId: senderId,
    role: "assistant",
    content: responseText,
  });
  // Re-send typing right before response so there's no gap
  await ig.sendTypingIndicator(senderId);
  await sendSplitMessages(ig, senderId, responseText);

  // Send report card if scan succeeded
  // Instagram requires a public URL for images — upload to Blob first
  if (scanId && scanResult) {
    try {
      const { buildReportCardResponse } = await import(
        "@/lib/report/skin-report"
      );
      const imageResponse = buildReportCardResponse(scanResult, new Date());
      const reportBuffer = Buffer.from(await imageResponse.arrayBuffer());

      // Upload report card to Vercel Blob (Instagram needs a public URL)
      const reportBlob = await put(
        `instagram-reports/${dbUser.id}/${scanId}.png`,
        reportBuffer,
        { access: "public", contentType: "image/png" }
      );

      await ig.sendImage(senderId, reportBlob.url);
      console.log("[Noor/IG] Report card sent to:", senderId);
    } catch (reportErr: any) {
      console.error(
        "[Noor/IG] Report card FAILED:",
        reportErr?.message || reportErr
      );
    }
  }
}

// ---- Intent-based onboarding start ----

async function startInstagramOnboarding(
  ig: InstagramClient,
  senderId: string,
  userId: string
): Promise<void> {
  await upsertOnboarding({
    userId,
    state: "ig_awaiting_intent",
    answers: {} as any,
  });
  const optionsText = formatOptionsText(INTENT_OPTIONS);
  await ig.sendQuickReplies(
    senderId,
    `Heyy! 💕 Main Noor hoon, tumhari skincare bestie.\n\nBatao, what's on your mind? (${optionsText})`,
    toQuickReplies(INTENT_OPTIONS, "INTENT")
  );
}

// ---- Text handling ----

async function handleTextMessage(
  ig: InstagramClient,
  senderId: string,
  dbUser: { id: string },
  userText: string
) {
  // Check onboarding status
  const onboardingRow = await getOnboarding(dbUser.id);

  // First-ever text from new user -> start intent-based onboarding
  if (!onboardingRow) {
    await startInstagramOnboarding(ig, senderId, dbUser.id);
    return;
  }

  // Mid-onboarding -> delegate to state machine
  if (onboardingRow.state.startsWith("ig_")) {
    await handleOnboardingReply(ig, senderId, dbUser.id, userText);
    return;
  }

  // Opt-out detection
  const OPT_OUT_PATTERNS =
    /\b(stop|unsubscribe|opt.?out|band karo|mat bhejo|nahi chahiye)\b/i;
  if (OPT_OUT_PATTERNS.test(userText)) {
    await saveInstagramMessage({
      instagramSenderId: senderId,
      role: "user",
      content: userText,
    });
    await ig.sendMessage(
      senderId,
      "Theek hai, main messages nahi bhejungi 💙 Kabhi baat karni ho toh wapas aa jana."
    );
    const { upsertMemory } = await import("@/db/queries");
    await upsertMemory({
      userId: dbUser.id,
      category: "preference",
      key: "opted_out",
      value: "true",
    });
    return;
  }

  // Soft history reset
  const RESET_PATTERNS =
    /\b(reset|clear|naya shuru|fresh start|sab bhool jao|forget everything)\b/i;
  if (RESET_PATTERNS.test(userText)) {
    await saveInstagramMessage({
      instagramSenderId: senderId,
      role: "assistant",
      content: "[CONVERSATION RESET BY USER]",
    });
    await ig.sendMessage(
      senderId,
      "Fresh start! 💕 Pichli baatein yaad nahi, batao kya chahiye."
    );
    return;
  }

  // Save user message
  await saveInstagramMessage({
    instagramSenderId: senderId,
    role: "user",
    content: userText,
  });

  // Load memories
  const memoriesBlock = await loadAndFormatMemories(dbUser.id);

  // Load conversation history
  const history = await getInstagramHistory({
    instagramSenderId: senderId,
    limit: 40,
  });

  // Respect conversation reset boundaries
  const resetIdx = history
    .map((m) => m.content)
    .lastIndexOf("[CONVERSATION RESET BY USER]");
  const effectiveHistory =
    resetIdx >= 0 ? history.slice(resetIdx + 1) : history;

  // Filter and clean messages for the AI
  const aiMessages = effectiveHistory
    .filter(
      (m) =>
        !m.content.includes("problem ho rahi hai") &&
        !m.content.includes("Something went wrong") &&
        !m.content.includes("[CONVERSATION RESET BY USER]")
    )
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

  // Validate: ensure proper alternation (Anthropic requirement)
  const validMessages = aiMessages.filter(
    (m) => m.content && m.content.trim().length > 0
  );

  // Ensure first message is from user
  if (validMessages.length > 0 && validMessages[0].role !== "user") {
    validMessages.shift();
  }

  // Ensure alternating roles
  const cleanMessages: typeof aiMessages = [];
  for (const msg of validMessages) {
    const last = cleanMessages[cleanMessages.length - 1];
    if (last && last.role === msg.role) {
      last.content += "\n" + msg.content;
    } else {
      cleanMessages.push({ ...msg });
    }
  }

  // Ensure last message is from user
  if (
    cleanMessages.length > 0 &&
    cleanMessages[cleanMessages.length - 1].role !== "user"
  ) {
    cleanMessages.push({ role: "user", content: userText });
  }

  // Send typing indicator — re-send every 15s to keep it visible
  await ig.sendTypingIndicator(senderId);
  const typingInterval = setInterval(() => {
    ig.sendTypingIndicator(senderId).catch(() => {});
  }, 15_000);

  // Run Ruhi agent (fast model for IG speed)
  let responseText: string;
  let agentSucceeded = false;
  try {
    const result = await runRuhiAgent(cleanMessages, {
      userId: dbUser.id,
      memoriesBlock: memoriesBlock ?? undefined,
      channel: "instagram",
      fast: true,
    });
    responseText = result.text || "";
    if (responseText) agentSucceeded = true;
  } catch (agentError: any) {
    console.error("[Ruhi/IG] Agent FAILED:", agentError?.message);
    responseText = "";
  } finally {
    clearInterval(typingInterval);
  }

  if (!responseText) {
    responseText =
      "Sorry yaar, abhi kuch problem ho rahi hai. Thodi der mein dobara try karo?";
  }

  if (agentSucceeded) {
    await saveInstagramMessage({
      instagramSenderId: senderId,
      role: "assistant",
      content: responseText,
    });
  }

  // Post-hoc safety net
  runPostHocSafetyNet(dbUser.id, userText).catch((err) =>
    console.error("[SafetyNet/IG] Unhandled:", err)
  );

  // Send response
  await sendSplitMessages(ig, senderId, responseText);
}

// ---- Postback handling (Ice Breakers / Quick Replies) ----

export async function handleInstagramPostback(
  entry: { sender: { id: string }; postback: { payload: string } },
  pageAccessToken: string,
  pageId: string
): Promise<void> {
  const senderId = entry.sender.id;
  const ig = new InstagramClient(pageAccessToken, pageId);
  const dbUser = await upsertInstagramUser({ instagramId: senderId });

  const payload = entry.postback.payload;

  if (payload === "ICE_about") {
    await upsertOnboarding({
      userId: dbUser.id,
      state: "ig_awaiting_intent",
      answers: {} as any,
    });
    await sendSplitMessages(
      ig,
      senderId,
      "Main Noor hoon 💕|||Tumhari personal skin companion, scan, product check, routine rating. Doctor nahi, friend hoon."
    );
    const optionsText = formatOptionsText(INTENT_OPTIONS);
    await ig.sendQuickReplies(
      senderId,
      `Kahan se shuru karein? (${optionsText})`,
      toQuickReplies(INTENT_OPTIONS, "INTENT")
    );
    return;
  }

  const iceToIntent: Record<string, string> = {
    ICE_skin_analysis: "INTENT_skin_analysis",
    ICE_skin_issue: "INTENT_skin_issue",
    ICE_just_chat: "INTENT_just_chat",
  };
  const intentPayload = iceToIntent[payload];
  if (!intentPayload) return;

  await upsertOnboarding({
    userId: dbUser.id,
    state: "ig_awaiting_intent",
    answers: {} as any,
  });
  await handleOnboardingReply(ig, senderId, dbUser.id, intentPayload);
}
