import { createPostgresState } from "@chat-adapter/state-pg";
import { createTelegramAdapter } from "@chat-adapter/telegram";
import type { Adapter } from "chat";
import { Chat } from "chat";

import { createChatAgent } from "@/lib/ai/agent";
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
import { botPrompt } from "@/lib/ai/prompts";
import { getLanguageModel } from "@/lib/ai/providers";
import { getWeather } from "@/lib/ai/tools/get-weather";

// --------------------------------------
// src/lib/bot.ts — Telegram-only bot
// --------------------------------------

interface BotThreadState {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
}

const MAX_HISTORY = 50;

/**
 * Builds the adapter map. Telegram-only.
 */
function buildAdapters(): Record<string, Adapter> {
  const result: Record<string, Adapter> = {};

  if (process.env.TELEGRAM_BOT_TOKEN) {
    result.telegram = createTelegramAdapter();
  }

  return result;
}

/**
 * Creates the Chat SDK bot instance with the Telegram adapter.
 * Returns null if TELEGRAM_BOT_TOKEN is not set (dev/CI safe).
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
   * and streams the response via Telegram.
   */
  async function handleMessage(
    thread: Parameters<Parameters<typeof bot.onNewMention>[0]>[0],
    message: Parameters<Parameters<typeof bot.onNewMention>[0]>[1],
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

    // Telegram supports streaming via post+edit
    const result = await agent.stream({ messages: history });
    await thread.post(result.fullStream);
    const response = await result.text;
    history.push({ role: "assistant", content: response });

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
