import { createHmac } from "node:crypto";
import { after } from "next/server";

import { bot } from "@/lib/bot";
import {
  processInstagramMessage,
  handleInstagramPostback,
  type InstagramMessagingEntry,
} from "@/lib/instagram/handler";
import {
  processTelegramUpdate,
  type TelegramUpdate,
} from "@/lib/telegram/handler";

// -----------------------------------
// src/app/(chat)/api/webhooks/[platform]/route.ts
//
// GET  — WhatsApp verification handshake (unchanged)
// POST — Telegram: custom handler with secret verification,
//        after() async processing, photo support.
//        Other platforms: delegated to @chat-adapter bot.
// -----------------------------------

type Platform = keyof NonNullable<typeof bot>["webhooks"];

/**
 * Handles WhatsApp webhook verification handshake (GET).
 * Meta sends a hub.verify_token challenge that must match WHATSAPP_VERIFY_TOKEN.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ platform: string }> }
) {
  const { platform } = await context.params;

  // ---- Instagram: webhook verification handshake ----
  if (platform === "instagram") {
    return handleInstagramVerify(request);
  }

  if (!bot) {
    return new Response("Bot not configured", { status: 404 });
  }

  const handler = bot.webhooks[platform as Platform];

  if (!handler) {
    return new Response(`Unknown platform: ${platform}`, { status: 404 });
  }

  return handler(request);
}

/**
 * Handles incoming webhook events (POST).
 *
 * For Telegram: verifies the X-Telegram-Bot-Api-Secret-Token header,
 * returns 200 immediately, then processes the update asynchronously
 * via `after()`.
 *
 * For other platforms: delegates to @chat-adapter bot handlers.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ platform: string }> }
) {
  const { platform } = await context.params;

  // ---- Telegram: custom handler ----
  if (platform === "telegram") {
    return handleTelegramPost(request);
  }

  // ---- Instagram: custom handler ----
  if (platform === "instagram") {
    return handleInstagramPost(request);
  }

  // ---- Other platforms: delegate to @chat-adapter ----
  if (!bot) {
    return new Response("Bot not configured", { status: 404 });
  }

  const handler = bot.webhooks[platform as Platform];

  if (!handler) {
    return new Response(`Unknown platform: ${platform}`, { status: 404 });
  }

  return handler(request, {
    waitUntil: (task) => after(() => task),
  });
}

/**
 * Telegram-specific POST handler.
 * 1. Verify webhook secret
 * 2. Parse update body
 * 3. Return 200 immediately
 * 4. Process update asynchronously via after()
 */
async function handleTelegramPost(request: Request) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;

  if (!botToken) {
    return new Response("Telegram bot not configured", { status: 404 });
  }

  // --- Verify webhook secret ---
  if (webhookSecret) {
    const headerSecret = request.headers.get(
      "X-Telegram-Bot-Api-Secret-Token"
    );
    if (headerSecret !== webhookSecret) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  // --- Parse the update body ---
  let update: TelegramUpdate;
  try {
    update = (await request.json()) as TelegramUpdate;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  // --- Return 200 immediately, process async ---
  after(async () => {
    try {
      await processTelegramUpdate(update, botToken);
    } catch (error) {
      console.error("[Webhook] Telegram update processing failed:", error);
    }
  });

  return new Response("OK", { status: 200 });
}

// ---- Instagram handlers ----

/**
 * Instagram webhook verification (GET).
 * Meta sends hub.mode, hub.verify_token, hub.challenge as query params.
 * We verify the token matches ours and return the challenge as plain text.
 */
function handleInstagramVerify(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  const verifyToken = process.env.INSTAGRAM_VERIFY_TOKEN;

  if (mode === "subscribe" && token === verifyToken && challenge) {
    console.log("[Webhook] Instagram verification succeeded");
    return new Response(challenge, { status: 200 });
  }

  console.warn("[Webhook] Instagram verification failed — token mismatch");
  return new Response("Forbidden", { status: 403 });
}

/**
 * Instagram webhook POST handler.
 * 1. Verify HMAC-SHA256 signature (X-Hub-Signature-256 header)
 * 2. Parse body
 * 3. Return 200 immediately (Meta retries if no response within 20s)
 * 4. Process each messaging entry asynchronously via after()
 */
async function handleInstagramPost(request: Request) {
  const appSecret = process.env.META_APP_SECRET;
  const pageAccessToken = process.env.INSTAGRAM_PAGE_ACCESS_TOKEN;
  const pageId = process.env.INSTAGRAM_PAGE_ID;

  if (!appSecret || !pageAccessToken || !pageId) {
    return new Response("Instagram not configured", { status: 404 });
  }

  // --- Read raw body for HMAC verification ---
  const rawBody = await request.text();

  // --- Verify HMAC-SHA256 signature ---
  // Try main app secret first, then Instagram-specific secret
  const signature = request.headers.get("X-Hub-Signature-256");
  if (signature) {
    const igAppSecret = process.env.INSTAGRAM_APP_SECRET;
    const expectedSig =
      "sha256=" +
      createHmac("sha256", appSecret).update(rawBody).digest("hex");
    const expectedSigIg = igAppSecret
      ? "sha256=" +
        createHmac("sha256", igAppSecret).update(rawBody).digest("hex")
      : null;
    if (signature !== expectedSig && signature !== expectedSigIg) {
      console.warn("[Webhook] Instagram signature mismatch");
      return new Response("Unauthorized", { status: 401 });
    }
  }

  // --- Parse body ---
  let body: {
    object: string;
    entry?: Array<{ messaging?: InstagramMessagingEntry[] }>;
  };
  try {
    body = JSON.parse(rawBody);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  // --- Return 200 immediately, process async ---
  if (body.entry) {
    for (const entry of body.entry) {
      if (entry.messaging) {
        for (const messagingEvent of entry.messaging) {
          if ((messagingEvent as any).postback) {
            // Handle postback (Ice Breakers, button taps)
            after(async () => {
              try {
                await handleInstagramPostback(
                  messagingEvent as any,
                  pageAccessToken,
                  pageId,
                );
              } catch (error) {
                console.error("[Webhook] Instagram postback processing failed:", error);
              }
            });
          } else {
            // Handle regular messages (existing code)
            after(async () => {
              try {
                await processInstagramMessage(
                  messagingEvent,
                  pageAccessToken,
                  pageId,
                );
              } catch (error) {
                console.error(
                  "[Webhook] Instagram message processing failed:",
                  error,
                );
              }
            });
          }
        }
      }
    }
  }

  return new Response("EVENT_RECEIVED", { status: 200 });
}
