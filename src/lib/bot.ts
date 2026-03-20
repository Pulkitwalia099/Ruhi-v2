import { createDiscordAdapter } from "@chat-adapter/discord";
import { createPostgresState } from "@chat-adapter/state-pg";
import { createTelegramAdapter } from "@chat-adapter/telegram";
import { createWhatsAppAdapter } from "@chat-adapter/whatsapp";
import type { Adapter } from "chat";
import { Chat } from "chat";

import { createChatAgent } from "@/lib/ai/agent";
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
import { botPrompt } from "@/lib/ai/prompts";
import { getLanguageModel } from "@/lib/ai/providers";
import { getWeather } from "@/lib/ai/tools/get-weather";

// --------------------------------------
// src/lib/bot.ts
//
// interface BotThreadState           L29
//   content                          L30
//   messages                         L30
//   role                             L30
// const MAX_HISTORY                  L33
// const STREAMING_ADAPTERS           L36
// function buildAdapters()           L42
// function createBot()               L64
// async function handleMessage()     L83
// export const bot                  L130
// --------------------------------------

interface BotThreadState {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
}

const MAX_HISTORY = 50;

/** Adapters that support streaming via post+edit or native streaming. */
const STREAMING_ADAPTERS = new Set(["slack", "telegram", "discord", "teams", "gchat"]);

/**
 * Builds the adapter map from available env vars.
 * Only includes adapters whose credentials are configured.
 */
function buildAdapters(): Record<string, Adapter> {
  const result: Record<string, Adapter> = {};

  if (process.env.DISCORD_BOT_TOKEN) {
    result.discord = createDiscordAdapter();
  }

  if (process.env.TELEGRAM_BOT_TOKEN) {
    result.telegram = createTelegramAdapter();
  }

  if (process.env.WHATSAPP_ACCESS_TOKEN) {
    result.whatsapp = createWhatsAppAdapter();
  }

  return result;
}

/**
 * Creates the Chat SDK bot instance with configured adapters.
 * Returns null if no adapter credentials are set (dev/CI safe).
 */
function createBot() {
  const adapters = buildAdapters();

  if (Object.keys(adapters).length === 0) {
    return null;
  }

  const bot = new Chat<typeof adapters, BotThreadState>({
    userName: "chatbot",
    adapters,
    state: createPostgresState(),
    onLockConflict: "force",
  });

  /**
   * Generates an AI response for an incoming message.
   * Loads conversation history from thread state, runs the agent,
   * and streams (Telegram) or posts (WhatsApp) the response.
   */
  async function handleMessage(
    thread: Parameters<Parameters<typeof bot.onNewMention>[0]>[0],
    message: Parameters<Parameters<typeof bot.onNewMention>[0]>[1]
  ) {
    await thread.startTyping();

    const state = await thread.state;
    const history = [...(state?.messages ?? [])];

    history.push({ role: "user", content: message.text });

    const agent = createChatAgent({
      model: getLanguageModel(DEFAULT_CHAT_MODEL),
      instructions: botPrompt,
      tools: { getWeather },
    });

    const stream = STREAMING_ADAPTERS.has(thread.adapter.name);

    if (stream) {
      const result = await agent.stream({ messages: history });
      await thread.post(result.fullStream);
      const response = await result.text;
      history.push({ role: "assistant", content: response });
    } else {
      const result = await agent.generate({ messages: history });
      await thread.post(result.text);
      history.push({ role: "assistant", content: result.text });
    }

    // Cap history to prevent unbounded growth
    const trimmed = history.slice(-MAX_HISTORY);
    await thread.setState({ messages: trimmed });
  }

  bot.onNewMention(async (thread, message) => {
    await thread.subscribe();
    await handleMessage(thread, message);
  });

  bot.onSubscribedMessage(async (thread, message) => {
    await handleMessage(thread, message);
  });

  return bot;
}

export const bot = createBot();
