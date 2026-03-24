import { put } from "@vercel/blob";
import { generateText } from "ai";

import { runRuhiAgent } from "@/lib/ai/agent";
import {
  analyzeProductPhoto,
  classifyPhotoIntent,
} from "@/lib/ai/analyze-product";
import { runScanPipeline } from "@/lib/ai/scan-pipeline";
import { loadAndFormatMemories } from "@/lib/memory/loader";
import { runPostHocSafetyNet } from "@/lib/memory/safety-net";
import {
  upsertInstagramUser,
  saveInstagramMessage,
  getInstagramHistory,
} from "@/db/queries";
import { InstagramClient } from "./client";

// ------------------------------------------------
// src/lib/instagram/handler.ts
//
// Processes incoming Instagram DM webhooks: text and
// photo messages. Mirrors the Telegram handler pattern
// but without slash commands or onboarding (for MVP).
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
 * Split an LLM response on `|||` delimiters and send each chunk
 * with a typing indicator and a natural delay in between.
 */
async function sendSplitMessages(
  ig: InstagramClient,
  recipientId: string,
  text: string,
) {
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

/** Set of message IDs already processed (in-memory, per instance). */
const processedMessages = new Set<string>();
const MAX_PROCESSED = 10_000;

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
  pageId: string,
) {
  const msg = entry.message;
  if (!msg) return;

  // Skip echo messages (our own bot replies)
  if (msg.is_echo) return;

  // Idempotency: skip duplicate messages
  if (processedMessages.has(msg.mid)) return;
  processedMessages.add(msg.mid);
  if (processedMessages.size > MAX_PROCESSED) {
    const entries = [...processedMessages];
    for (let i = 0; i < entries.length / 2; i++) {
      processedMessages.delete(entries[i]);
    }
  }

  const senderId = entry.sender.id;
  const ig = new InstagramClient(pageAccessToken, pageId);

  try {
    // Upsert user
    const dbUser = await upsertInstagramUser({ instagramId: senderId });

    // Check for image attachments
    const imageAttachment = msg.attachments?.find((a) => a.type === "image");

    if (imageAttachment) {
      // ---- PHOTO PATH ----
      await handlePhotoMessage(ig, senderId, dbUser, imageAttachment.payload.url, msg.text);
      return;
    }

    if (msg.text) {
      // ---- TEXT PATH ----
      await handleTextMessage(ig, senderId, dbUser, msg.text);
      return;
    }

    // Unsupported message type (video, audio, sticker, etc.)
    await ig.sendMessage(
      senderId,
      "Hey! Abhi mein sirf text aur photos handle kar sakti hoon. Photo bhejo for skin analysis ya text mein kuch bhi poocho!",
    );
  } catch (error: any) {
    const errDetail = error?.message || String(error);
    console.error("[Instagram] OUTER ERROR:", errDetail);
    try {
      await ig.sendMessage(
        senderId,
        "Oops! Something went wrong. Please try again in a moment.",
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
  caption?: string,
) {
  const userText = caption ?? "";

  // Download image from Instagram CDN
  const photoBuffer = await ig.downloadImage(imageUrl);

  // Upload to Vercel Blob for permanent storage
  const blob = await put(
    `instagram-photos/${dbUser.id}/${Date.now()}.jpg`,
    photoBuffer,
    { access: "public", contentType: "image/jpeg" },
  );

  // Send "thinking" message
  const thinkingMsg =
    SCAN_THINKING_MESSAGES[
      Math.floor(Math.random() * SCAN_THINKING_MESSAGES.length)
    ];
  await ig.sendMessage(senderId, thinkingMsg);
  await ig.sendTypingIndicator(senderId);

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
    userText?.substring(0, 30),
  );

  if (intent === "product") {
    // ---- PRODUCT PATH ----
    const productMemories = await loadAndFormatMemories(dbUser.id);
    const analysis = await analyzeProductPhoto(
      photoBuffer,
      dbUser.id,
      productMemories ?? undefined,
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
    await sendSplitMessages(ig, senderId, analysis);
    return;
  }

  // ---- SELFIE PATH ----
  const imageBase64 = photoBuffer.toString("base64");

  const { scanResult, scanId, comparisonBlock, cycleContext } =
    await runScanPipeline({
      imageData: imageBase64,
      userId: dbUser.id,
      imageUrl: blob.url,
    });

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
        photoMemoriesBlock ?? undefined,
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
        { access: "public", contentType: "image/png" },
      );

      await ig.sendImage(senderId, reportBlob.url);
      console.log("[Noor/IG] Report card sent to:", senderId);
    } catch (reportErr: any) {
      console.error(
        "[Noor/IG] Report card FAILED:",
        reportErr?.message || reportErr,
      );
    }
  }
}

// ---- Text handling ----

async function handleTextMessage(
  ig: InstagramClient,
  senderId: string,
  dbUser: { id: string },
  userText: string,
) {
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

  // Filter and clean messages for the AI
  const aiMessages = history
    .filter(
      (m) =>
        !m.content.includes("problem ho rahi hai") &&
        !m.content.includes("Something went wrong"),
    )
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

  // Validate: ensure proper alternation (Anthropic requirement)
  const validMessages = aiMessages.filter(
    (m) => m.content && m.content.trim().length > 0,
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

  // Send typing indicator
  await ig.sendTypingIndicator(senderId);

  // Run Ruhi agent
  let responseText: string;
  let agentSucceeded = false;
  try {
    const result = await runRuhiAgent(cleanMessages, {
      userId: dbUser.id,
      memoriesBlock: memoriesBlock ?? undefined,
    });
    responseText = result.text || "";
    if (responseText) agentSucceeded = true;
  } catch (agentError: any) {
    console.error("[Ruhi/IG] Agent FAILED:", agentError?.message);
    responseText = "";
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
    console.error("[SafetyNet/IG] Unhandled:", err),
  );

  // Send response
  await sendSplitMessages(ig, senderId, responseText);
}
