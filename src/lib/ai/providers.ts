import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { customProvider } from "ai";
import { isTestEnvironment } from "../constants";
import { env } from "../env";
import { titleModel } from "./models";

const openai = createOpenAI({
  apiKey: env.OPENAI_API_KEY,
});

const anthropic = createAnthropic({
  apiKey: env.ANTHROPIC_API_KEY,
});

const google = createGoogleGenerativeAI({
  apiKey: env.GOOGLE_GENERATIVE_AI_API_KEY,
});

const providers: Record<
  string,
  (modelId: string) => ReturnType<typeof openai>
> = {
  openai: (id) => openai(id),
  anthropic: (id) => anthropic(id),
  google: (id) => google(id),
};

function resolveModel(compositeId: string) {
  const [provider, ...rest] = compositeId.split("/");
  const modelId = rest.join("/");
  const factory = providers[provider];
  if (!factory) {
    throw new Error(`Unknown provider: ${provider}`);
  }
  return factory(modelId);
}

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

export function getLanguageModel(modelId: string) {
  if (isTestEnvironment && myProvider) {
    return myProvider.languageModel(modelId);
  }
  return resolveModel(modelId);
}

export function getTitleModel() {
  if (isTestEnvironment && myProvider) {
    return myProvider.languageModel("title-model");
  }
  return resolveModel(titleModel.id);
}
