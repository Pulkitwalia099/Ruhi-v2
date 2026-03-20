import type { InferUITool, UIMessage } from "ai";
import { z } from "zod";
import type { ArtifactKind } from "@/components/chat/artifact";
import type { Suggestion } from "@/db/schema";
import type { createDocument } from "./ai/tools/create-document";
import type { getWeather } from "./ai/tools/get-weather";
import type { requestSuggestions } from "./ai/tools/request-suggestions";
import type { updateDocument } from "./ai/tools/update-document";

// -----------------------------------------
// src/lib/types.ts
//
// export const messageMetadataSchema    L44
// export type MessageMetadata           L48
// type weatherTool                      L50
// type createDocumentTool               L51
// type updateDocumentTool               L52
// type requestSuggestionsTool           L53
// export type ChatTools                 L57
// getWeather                            L58
// createDocument                        L59
// updateDocument                        L60
// requestSuggestions                    L61
// export type CustomUIDataTypes         L64
// textDelta                             L65
// imageDelta                            L66
// sheetDelta                            L67
// codeDelta                             L68
// suggestion                            L69
// appendMessage                         L70
// id                                    L71
// title                                 L72
// kind                                  L73
// clear                                 L74
// finish                                L75
// " chat-title                          L76
// export type ChatMessage               L79
// export type Attachment                L85
// name                                  L86
// url                                   L87
// contentType                           L88
// -----------------------------------------

export const messageMetadataSchema = z.object({
  createdAt: z.string(),
});

export type MessageMetadata = z.infer<typeof messageMetadataSchema>;

type weatherTool = InferUITool<typeof getWeather>;
type createDocumentTool = InferUITool<ReturnType<typeof createDocument>>;
type updateDocumentTool = InferUITool<ReturnType<typeof updateDocument>>;
type requestSuggestionsTool = InferUITool<
  ReturnType<typeof requestSuggestions>
>;

export type ChatTools = {
  getWeather: weatherTool;
  createDocument: createDocumentTool;
  updateDocument: updateDocumentTool;
  requestSuggestions: requestSuggestionsTool;
};

export type CustomUIDataTypes = {
  textDelta: string;
  imageDelta: string;
  sheetDelta: string;
  codeDelta: string;
  suggestion: Suggestion;
  appendMessage: string;
  id: string;
  title: string;
  kind: ArtifactKind;
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
