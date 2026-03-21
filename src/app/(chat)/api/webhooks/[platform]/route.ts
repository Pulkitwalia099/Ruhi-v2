import { after } from "next/server";

import { bot } from "@/lib/bot";
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
  if (!bot) {
    return new Response("Bot not configured", { status: 404 });
  }

  const { platform } = await context.params;
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
