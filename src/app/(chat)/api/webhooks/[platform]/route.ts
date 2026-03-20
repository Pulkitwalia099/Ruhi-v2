import { after } from "next/server";

import { bot } from "@/lib/bot";

// -----------------------------------
// src/app/(chat)/api/webhooks/[platform]/route.ts
//
// type Platform                   L17
// export async function GET()     L23
// params                          L25
// platform                        L25
// export async function POST()    L46
// params                          L48
// platform                        L48
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
 * Uses `after()` for waitUntil so message processing completes
 * after the HTTP response is sent — required on Vercel serverless.
 */
export async function POST(
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

  return handler(request, {
    waitUntil: (task) => after(() => task),
  });
}
