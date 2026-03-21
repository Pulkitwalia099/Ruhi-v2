// -----------------------------------------
// src/lib/ai/models.ts
//
// Simplified model registry for Ruhi Telegram MVP.
// Plain "provider/model" strings — AI Gateway routes automatically.
// -----------------------------------------

export const DEFAULT_CHAT_MODEL = "anthropic/claude-haiku-4-5-20251001";
export const VISION_MODEL = "google/gemini-2.5-flash-preview-05-20";

export const titleModel = {
  id: "anthropic/claude-haiku-4-5-20251001",
  name: "Claude Haiku 4.5",
  provider: "anthropic",
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
  {
    id: "anthropic/claude-haiku-4-5-20251001",
    name: "Claude Haiku 4.5",
    provider: "anthropic",
    description: "Fast and affordable — primary chat model",
    capabilities: { tools: true, vision: true, reasoning: true },
  },
  {
    id: "google/gemini-2.5-flash-preview-05-20",
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
