import type { SharedV3ProviderOptions } from "@ai-sdk/provider";
import type { LanguageModel, ToolSet } from "ai";
import { generateText, stepCountIs, ToolLoopAgent } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { buildRuhiSystemPrompt } from "./prompts";
import { getLanguageModel } from "./providers";
import { getCycleContext, logCycle, getScanHistory, saveMemory } from "./tools";

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
 * Uses generateText with cycle tools (getCycleContext, logCycle, getScanHistory).
 * Face scan is handled directly in the handler (needs image binary).
 * userId is injected into the system prompt so the LLM knows what to pass to tools.
 */
export async function runRuhiAgent(
  messages: Array<{ role: "user" | "assistant"; content: any }>,
  options?: { userId?: string; cycleContext?: string; memoriesBlock?: string },
) {
  const anthropic = createAnthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  let systemPrompt = buildRuhiSystemPrompt(
    options?.cycleContext,
    options?.memoriesBlock ?? undefined,
  );

  // Inject userId so the LLM can pass it to tools
  if (options?.userId) {
    systemPrompt += `\n\n## Internal Context\nThe current user's database ID is: ${options.userId}\nAlways use this exact ID when calling tools like getCycleContext, logCycle, getScanHistory, or saveMemory.`;
  }

  const result = await generateText({
    model: anthropic("claude-haiku-4-5-20251001"),
    system: systemPrompt,
    messages,
    tools: { getCycleContext, logCycle, getScanHistory, saveMemory },
    stopWhen: stepCountIs(5),
  });

  return result;
}
