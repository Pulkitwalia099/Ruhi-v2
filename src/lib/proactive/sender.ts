import { generateText } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { buildRuhiSystemPrompt } from "@/lib/ai/prompts";
import { loadAndFormatMemories } from "@/lib/memory/loader";
import { logProactiveMessage, saveTelegramMessage } from "@/db/queries";
import { TelegramClient } from "@/lib/telegram/client";
import type { ProactiveAction } from "./product-followup";

/**
 * Generate a proactive message via LLM and send it to the user on Telegram.
 * Logs the message to proactive_log and telegram_messages.
 */
export async function generateAndSend({
  userId,
  telegramChatId,
  action,
  botToken,
}: {
  userId: string;
  telegramChatId: number;
  action: ProactiveAction;
  botToken: string;
}): Promise<boolean> {
  try {
    // Load memories for personalization
    const memoriesBlock = await loadAndFormatMemories(userId);

    const anthropic = createAnthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    let systemPrompt = buildRuhiSystemPrompt(undefined, memoriesBlock ?? undefined);
    systemPrompt += `\n\nYou are sending a proactive check-in message on Telegram. This is NOT a reply to a user message — you are initiating contact. Keep it casual, warm, and brief (1-2 sentences max). Sound like you're texting a friend, not sending a notification.`;

    const result = await generateText({
      model: anthropic("claude-haiku-4-5-20251001"),
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: action.prompt,
        },
      ],
    });

    const messageText = result.text;
    if (!messageText) {
      console.error("[Proactive] LLM returned empty message for", action.type);
      return false;
    }

    // Send via Telegram
    const tg = new TelegramClient(botToken);
    await tg.sendMessage(telegramChatId, messageText);

    // Log to proactive_log
    await logProactiveMessage({
      userId,
      type: action.type,
      referenceId: action.referenceId,
      message: messageText,
    });

    // Save to telegram_messages so it appears in conversation history
    await saveTelegramMessage({
      telegramChatId,
      role: "assistant",
      content: messageText,
    });

    console.log(
      `[Proactive] Sent ${action.type} to user ${userId}: ${messageText.substring(0, 60)}...`,
    );
    return true;
  } catch (error) {
    console.error(`[Proactive] Failed to send ${action.type}:`, error);
    return false;
  }
}
