import type { SharedV3ProviderOptions } from "@ai-sdk/provider";
import type { LanguageModel, ToolSet } from "ai";
import { generateText, stepCountIs, ToolLoopAgent } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { buildRuhiSystemPrompt } from "./prompts";
import { getLanguageModel } from "./providers";

// ----------------------------------------
// src/lib/ai/agent.ts
//
// export function createChatAgent()    — web chat (streaming)
// export async function runRuhiAgent() — Telegram bot (non-streaming)
// ----------------------------------------

/**
 * Creates a ToolLoopAgent for web chat streaming.
 * Used by route.ts for the browser-based chat UI.
 */
export function createChatAgent({
  model,
  instructions,
  tools,
  activeTools,
  providerOptions,
}: {
  model: LanguageModel;
  instructions: string;
  tools: ToolSet;
  activeTools?: string[];
  providerOptions?: SharedV3ProviderOptions;
}) {
  return new ToolLoopAgent({
    model,
    instructions,
    tools,
    stopWhen: stepCountIs(5),
    activeTools,
    providerOptions,
  });
}

/**
 * Runs the Ruhi agent for Telegram.
 * Uses generateText (non-streaming) with the Ruhi system prompt.
 * For MVP, tools are NOT passed — the agent just chats.
 * Face scan is handled directly in the handler.
 * Cycle tools will be added once basic chat is confirmed working.
 */
export async function runRuhiAgent(
  messages: Array<{ role: "user" | "assistant"; content: any }>,
  cycleContext?: string,
) {
  const anthropic = createAnthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const result = await generateText({
    model: anthropic("claude-haiku-4-5-20251001"),
    system: buildRuhiSystemPrompt(cycleContext),
    messages,
  });

  return result;
}
