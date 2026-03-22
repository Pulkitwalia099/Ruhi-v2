import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { customProvider, gateway } from "ai";
import { isTestEnvironment } from "../constants";
import { env } from "../env";
import { DIRECT_MODEL_MAP, titleModel } from "./models";

// -----------------------------------------
// src/lib/ai/providers.ts
//
// Model resolution strategy:
// 1. Test env → mock provider
// 2. Gateway available (VERCEL_OIDC_TOKEN or AI_GATEWAY_API_KEY) → gateway()
// 3. Fallback → direct provider SDKs with API keys
// -----------------------------------------

const useGateway = !!(
  process.env.VERCEL_OIDC_TOKEN || process.env.AI_GATEWAY_API_KEY
);

// --- Direct provider SDKs (fallback for local dev) ---

const openai = createOpenAI({
  apiKey: env.OPENAI_API_KEY,
});

const anthropic = createAnthropic({
  apiKey: env.ANTHROPIC_API_KEY,
});

const google = createGoogleGenerativeAI({
  apiKey: env.GOOGLE_GENERATIVE_AI_API_KEY,
});

const directProviders: Record<
  string,
  (modelId: string) => ReturnType<typeof openai>
> = {
  openai: (id) => openai(id),
  anthropic: (id) => anthropic(id),
  google: (id) => google(id),
};

function resolveDirectModel(compositeId: string) {
  const [provider, ...rest] = compositeId.split("/");
  const gatewaySlug = rest.join("/");
  // Map gateway slugs (e.g. "claude-haiku-4.5") to direct API IDs
  // (e.g. "claude-haiku-4-5-20251001"). Passes through unmapped IDs as-is.
  const modelId = DIRECT_MODEL_MAP[gatewaySlug] ?? gatewaySlug;
  const factory = directProviders[provider];
  if (!factory) {
    throw new Error(`Unknown provider: ${provider}`);
  }
  return factory(modelId);
}

// --- Test mock provider ---

export const myProvider = isTestEnvironment
  ? (() => {
      const { chatModel, titleModel } = require("./models.mock");
      return customProvider({
        languageModels: {
          "chat-model": chatModel,
          "title-model": titleModel,
        },
      });
    })()
  : null;

// --- Public API ---

export function getLanguageModel(modelId: string) {
  // 1. Test environment → mock
  if (isTestEnvironment && myProvider) {
    return myProvider.languageModel(modelId);
  }

  // 2. Gateway available → route through Vercel AI Gateway
  if (useGateway) {
    return gateway(modelId);
  }

  // 3. Fallback → direct provider SDKs
  return resolveDirectModel(modelId);
}

export function getTitleModel() {
  if (isTestEnvironment && myProvider) {
    return myProvider.languageModel("title-model");
  }
  return getLanguageModel(titleModel.id);
}
