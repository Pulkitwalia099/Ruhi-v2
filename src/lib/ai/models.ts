// -----------------------------------------
// src/lib/ai/models.ts
//
// Simplified model registry for Ruhi Telegram MVP.
// Uses gateway-compatible "provider/model" format (dots for versions).
// -----------------------------------------

export const DEFAULT_CHAT_MODEL = "google/gemini-2.5-pro";
export const VISION_MODEL = "google/gemini-2.5-flash";

export const titleModel = {
  id: "anthropic/claude-haiku-4.5",
  name: "Claude Haiku 4.5",
  provider: "anthropic",
  description: "Fast model for title generation",
};

/**
 * Maps gateway model slugs to direct API model IDs.
 * Used by the direct SDK fallback path when gateway is unavailable.
 * Gateway translates slugs automatically; direct SDKs need exact API IDs.
 */
export const DIRECT_MODEL_MAP: Record<string, string> = {
  "claude-haiku-4.5": "claude-haiku-4-5-20251001",
  "claude-sonnet-4.6": "claude-sonnet-4-6-20250326",
  "gemini-2.5-pro": "gemini-2.5-pro",
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
  {
    id: "google/gemini-2.5-pro",
    name: "Gemini 2.5 Pro",
    provider: "google",
    description: "Primary chat model — strong reasoning and multilingual",
    capabilities: { tools: true, vision: true, reasoning: true },
  },
  {
    id: "anthropic/claude-haiku-4.5",
    name: "Claude Haiku 4.5",
    provider: "anthropic",
    description: "Fast and affordable — fallback model",
    capabilities: { tools: true, vision: true, reasoning: true },
  },
  {
    id: "google/gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    provider: "google",
    description: "Fast multimodal model — vision tasks",
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
  {} as Record<string, ChatModel[]>,
);
