// -----------------------------------------
// src/lib/ai/models.ts
//
// export const DEFAULT_CHAT_MODEL       L25
// export const titleModel               L27
// export type ModelCapabilities         L34
// tools                                 L35
// vision                                L36
// reasoning                             L37
// export type ChatModel                 L40
// id                                    L41
// name                                  L42
// provider                              L43
// description                           L44
// reasoningEffort                       L45
// capabilities                          L46
// export const chatModels               L49
// export function getCapabilities()    L211
// export const isDemo                  L217
// export function getActiveModels()    L219
// export const allowedModelIds         L223
// export const modelsByProvider        L225
// -----------------------------------------

export const DEFAULT_CHAT_MODEL = "openai/gpt-5.2";

export const titleModel = {
  id: "openai/gpt-4.1-nano",
  name: "GPT-4.1 Nano",
  provider: "openai",
  description: "Fast model for title generation",
};

export type ModelCapabilities = {
  tools: boolean;
  vision: boolean;
  reasoning: boolean;
};

export type ChatModel = {
  id: string;
  name: string;
  provider: string;
  description: string;
  reasoningEffort?: "none" | "minimal" | "low" | "medium" | "high";
  capabilities: ModelCapabilities;
};

export const chatModels: ChatModel[] = [
  // ── OpenAI ──────────────────────────────────────────────

  // GPT-5 family
  {
    id: "openai/gpt-5-pro",
    name: "GPT-5 Pro",
    provider: "openai",
    description: "Most capable OpenAI model",
    capabilities: { tools: true, vision: true, reasoning: true },
  },
  {
    id: "openai/gpt-5",
    name: "GPT-5",
    provider: "openai",
    description: "OpenAI flagship model",
    capabilities: { tools: true, vision: true, reasoning: true },
  },
  {
    id: "openai/gpt-5-mini",
    name: "GPT-5 Mini",
    provider: "openai",
    description: "Compact GPT-5 variant",
    capabilities: { tools: true, vision: true, reasoning: true },
  },
  {
    id: "openai/gpt-5-nano",
    name: "GPT-5 Nano",
    provider: "openai",
    description: "Fastest GPT-5 variant",
    capabilities: { tools: true, vision: true, reasoning: true },
  },

  // GPT-5.2
  {
    id: "openai/gpt-5.2",
    name: "GPT-5.2",
    provider: "openai",
    description: "Latest GPT-5 series model",
    capabilities: { tools: true, vision: true, reasoning: true },
  },
  {
    id: "openai/gpt-5.2-pro",
    name: "GPT-5.2 Pro",
    provider: "openai",
    description: "Most capable GPT-5.2 variant",
    capabilities: { tools: true, vision: true, reasoning: true },
  },

  // GPT-5.1
  {
    id: "openai/gpt-5.1",
    name: "GPT-5.1",
    provider: "openai",
    description: "GPT-5.1 series model",
    capabilities: { tools: true, vision: true, reasoning: true },
  },

  // GPT-4.1 family
  {
    id: "openai/gpt-4.1",
    name: "GPT-4.1",
    provider: "openai",
    description: "Strong general-purpose model",
    capabilities: { tools: true, vision: true, reasoning: true },
  },
  {
    id: "openai/gpt-4.1-mini",
    name: "GPT-4.1 Mini",
    provider: "openai",
    description: "Fast and affordable",
    capabilities: { tools: true, vision: true, reasoning: true },
  },
  {
    id: "openai/gpt-4.1-nano",
    name: "GPT-4.1 Nano",
    provider: "openai",
    description: "Ultra-fast, lowest cost",
    capabilities: { tools: true, vision: true, reasoning: true },
  },

  // Reasoning models
  {
    id: "openai/o3",
    name: "o3",
    provider: "openai",
    description: "Advanced reasoning model",
    reasoningEffort: "medium",
    capabilities: { tools: true, vision: false, reasoning: true },
  },
  {
    id: "openai/o4-mini",
    name: "o4 Mini",
    provider: "openai",
    description: "Fast reasoning model",
    reasoningEffort: "medium",
    capabilities: { tools: true, vision: false, reasoning: true },
  },

  // ── Anthropic ───────────────────────────────────────────

  {
    id: "anthropic/claude-opus-4-6",
    name: "Claude Opus 4.6",
    provider: "anthropic",
    description: "Most capable Anthropic model",
    capabilities: { tools: true, vision: true, reasoning: true },
  },
  {
    id: "anthropic/claude-sonnet-4-6",
    name: "Claude Sonnet 4.6",
    provider: "anthropic",
    description: "Fast and capable",
    capabilities: { tools: true, vision: true, reasoning: true },
  },
  {
    id: "anthropic/claude-opus-4-5",
    name: "Claude Opus 4.5",
    provider: "anthropic",
    description: "Previous-gen flagship",
    capabilities: { tools: true, vision: true, reasoning: true },
  },
  {
    id: "anthropic/claude-sonnet-4-20250514",
    name: "Claude Sonnet 4",
    provider: "anthropic",
    description: "Balanced performance and cost",
    capabilities: { tools: true, vision: true, reasoning: true },
  },
  {
    id: "anthropic/claude-haiku-4-5",
    name: "Claude Haiku 4.5",
    provider: "anthropic",
    description: "Fast and affordable",
    capabilities: { tools: true, vision: true, reasoning: true },
  },

  // ── Google ──────────────────────────────────────────────

  {
    id: "google/gemini-2.5-pro",
    name: "Gemini 2.5 Pro",
    provider: "google",
    description: "Google flagship model",
    capabilities: { tools: true, vision: true, reasoning: true },
  },
  {
    id: "google/gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    provider: "google",
    description: "Fast multimodal model",
    capabilities: { tools: true, vision: true, reasoning: true },
  },
  {
    id: "google/gemini-2.5-flash-lite",
    name: "Gemini 2.5 Flash Lite",
    provider: "google",
    description: "Lightweight and fast",
    capabilities: { tools: true, vision: true, reasoning: true },
  },
];

export function getCapabilities(): Record<string, ModelCapabilities> {
  return Object.fromEntries(chatModels.map((m) => [m.id, m.capabilities]));
}

import { env } from "../env";

export const isDemo = env.IS_DEMO;

export function getActiveModels(): ChatModel[] {
  return chatModels;
}

export const allowedModelIds = new Set(chatModels.map((m) => m.id));

export const modelsByProvider = chatModels.reduce(
  (acc, model) => {
    if (!acc[model.provider]) {
      acc[model.provider] = [];
    }
    acc[model.provider].push(model);
    return acc;
  },
  {} as Record<string, ChatModel[]>
);
