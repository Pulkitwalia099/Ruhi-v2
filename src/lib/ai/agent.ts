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
 * Uses generateText (non-streaming) with the 4 domain tools
 * and stops after at most 5 tool-call steps.
 */
export async function runRuhiAgent(
  messages: ModelMessage[],
  cycleContext?: string,
) {
  const result = await generateText({
    model: getLanguageModel(DEFAULT_CHAT_MODEL),
    system: buildRuhiSystemPrompt(cycleContext),
    messages,
    tools: {
      getCycleContext,
      logCycle,
      analyzeFaceScan,
      getScanHistory,
    },
    stopWhen: stepCountIs(5),
  });

  return result;
}
