import type { InferUITool, UIMessage } from "ai";
import { z } from "zod";
import type { Suggestion } from "@/db/schema";
import type { getWeather } from "./ai/tools/get-weather";

// -----------------------------------------
// src/lib/types.ts
// -----------------------------------------

export const messageMetadataSchema = z.object({
  createdAt: z.string(),
});

export type MessageMetadata = z.infer<typeof messageMetadataSchema>;

type weatherTool = InferUITool<typeof getWeather>;

export type ChatTools = {
  getWeather: weatherTool;
};

export type CustomUIDataTypes = {
  suggestion: Suggestion;
  appendMessage: string;
  id: string;
  title: string;
  clear: null;
  finish: null;
  "chat-title": string;
};

export type ChatMessage = UIMessage<
  MessageMetadata,
  CustomUIDataTypes,
  ChatTools
>;

export type Attachment = {
  name: string;
  url: string;
  contentType: string;
};
