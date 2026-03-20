import type { DiscordAdapter } from "@chat-adapter/discord";
import { after } from "next/server";

import { bot } from "@/lib/bot";

// ----------------------------------
// src/app/(chat)/api/discord/gateway/route.ts
//
// export const maxDuration       L13
// export async function GET()    L24
// ----------------------------------

export const maxDuration = 800;

/**
 * Starts the Discord Gateway WebSocket listener.
 * Discord doesn't push messages via webhooks — messages arrive through
 * the Gateway. This route connects to the WebSocket and forwards
 * events to /api/webhooks/discord for processing.
 *
 * For local dev: visit this URL in your browser to start listening.
 * For production: set up a Vercel cron to hit this every 9 minutes.
 */
export async function GET(request: Request): Promise<Response> {
  if (!bot) {
    return new Response("Bot not configured", { status: 404 });
  }

  // In production, protect with CRON_SECRET
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  const durationMs = 10 * 60 * 1000; // 10 minutes

  const host =
    process.env.VERCEL_URL ??
    request.headers.get("host") ??
    "localhost:3000";
  const protocol = host.includes("localhost") ? "http" : "https";
  const webhookUrl = `${protocol}://${host}/api/webhooks/discord`;

  await bot.initialize();

  const discord = bot.getAdapter("discord") as DiscordAdapter;

  return discord.startGatewayListener(
    { waitUntil: (task) => after(() => task) },
    durationMs,
    undefined,
    webhookUrl,
  );
}
