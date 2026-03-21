import type { SharedV3ProviderOptions } from "@ai-sdk/provider";
import type { LanguageModel, ToolSet, ModelMessage } from "ai";
import { generateText, stepCountIs, ToolLoopAgent } from "ai";
import {
  getCycleContext,
  logCycle,
  analyzeFaceScan,
  getScanHistory,
} from "./tools";
import { buildRuhiSystemPrompt } from "./prompts";
import { DEFAULT_CHAT_MODEL } from "./models";
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
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  cycleContext?: string,
) {
  const result = await generateText({
    model: getLanguageModel(DEFAULT_CHAT_MODEL),
    system: buildRuhiSystemPrompt(cycleContext),
    messages,
  });

  return result;
}
