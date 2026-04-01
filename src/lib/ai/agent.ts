import type { SharedV3ProviderOptions } from "@ai-sdk/provider";
import type { LanguageModel, ToolSet } from "ai";
import { generateText, stepCountIs, ToolLoopAgent } from "ai";
import { buildRuhiSystemPrompt } from "./prompts";
import { getLanguageModel } from "./providers";
import { DEFAULT_CHAT_MODEL, FAST_CHAT_MODEL } from "./models";
import {
  getCycleContext,
  logCycle,
  getScanHistory,
  saveMemory,
  searchSkincareKnowledge,
} from "./tools";

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
 * Runs the Ruhi agent for Telegram (or other non-web channels).
 * Uses generateText with cycle tools (getCycleContext, logCycle, getScanHistory).
 * Face scan is handled directly in the handler (needs image binary).
 * userId is injected into the system prompt so the LLM knows what to pass to tools.
 *
 * @param messages — conversation history
 * @param options.channel — 'telegram' (default) | 'web' | 'instagram'
 */
export async function runRuhiAgent(
  messages: Array<{ role: "user" | "assistant"; content: any }>,
  options?: {
    userId?: string;
    cycleContext?: string;
    memoriesBlock?: string;
    channel?: "web" | "telegram" | "instagram";
    fast?: boolean;
  },
) {
  const channel = options?.channel ?? "telegram";

  let systemPrompt = buildRuhiSystemPrompt(
    options?.cycleContext,
    options?.memoriesBlock ?? undefined,
    channel,
  );

  // Inject userId so the LLM can pass it to tools
  if (options?.userId) {
    systemPrompt += `\n\n## Internal Context\nThe current user's database ID is: ${options.userId}\nAlways use this exact ID when calling tools like getCycleContext, logCycle, getScanHistory, or saveMemory.`;
  }

  const modelId = options?.fast ? FAST_CHAT_MODEL : DEFAULT_CHAT_MODEL;

  const result = await generateText({
    model: getLanguageModel(modelId),
    system: systemPrompt,
    messages,
    tools: {
      getCycleContext,
      logCycle,
      getScanHistory,
      saveMemory,
      searchSkincareKnowledge,
    },
    stopWhen: stepCountIs(5),
  });

  return result;
}
