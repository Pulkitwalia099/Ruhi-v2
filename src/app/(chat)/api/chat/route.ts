import { geolocation, ipAddress } from "@vercel/functions";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateId,
} from "ai";
import { checkBotId } from "botid/server";
import { headers } from "next/headers";
import { after } from "next/server";
import { createResumableStreamContext } from "resumable-stream";
import {
  createStreamId,
  deleteChatById,
  getChatById,
  getMessageCountByUserId,
  getMessagesByChatId,
  saveChat,
  saveMessages,
  updateChatTitleById,
  updateMessage,
} from "@/db/queries";
import type { DBMessage } from "@/db/schema";
import { createChatAgent } from "@/lib/ai/agent";
import { entitlementsByIsAnonymous } from "@/lib/ai/entitlements";
import { runScanPipeline } from "@/lib/ai/scan-pipeline";
import {
  allowedModelIds,
  chatModels,
  DEFAULT_CHAT_MODEL,
} from "@/lib/ai/models";
import { type RequestHints, getRequestPromptFromHints, buildRuhiSystemPrompt } from "@/lib/ai/prompts";
import { getLanguageModel } from "@/lib/ai/providers";
import { getCycleContext, logCycle, getScanHistory, saveMemory } from "@/lib/ai/tools";
import { loadAndFormatMemories } from "@/lib/memory/loader";
import { runPostHocSafetyNet } from "@/lib/memory/safety-net";
import { auth } from "@/lib/auth";
import { env } from "@/lib/env";
import { ChatbotError } from "@/lib/errors";
import { checkIpRateLimit } from "@/lib/ratelimit";
import type { ChatMessage } from "@/lib/types";
import { convertToUIMessages, generateUUID } from "@/lib/utils";
import { generateTitleFromUserMessage } from "../../actions";
import { type PostRequestBody, postRequestBodySchema } from "./schema";

// --------------------------------------
// src/app/(chat)/api/chat/route.ts
//
// export const maxDuration           L57
// function getStreamContext()        L59
// export async function POST()       L69
// async consumeSseStream()          L305
// export async function DELETE()    L336
// --------------------------------------

export const maxDuration = 60;

function getStreamContext() {
  try {
    return createResumableStreamContext({ waitUntil: after });
  } catch (_) {
    return null;
  }
}

export { getStreamContext };

export async function POST(request: Request) {
  let requestBody: PostRequestBody;

  try {
    const json = await request.json();
    requestBody = postRequestBodySchema.parse(json);
  } catch (_) {
    return new ChatbotError("bad_request:api").toResponse();
  }

  try {
    const { id, message, messages, selectedChatModel, selectedVisibilityType } =
      requestBody;

    const [, session] = await Promise.all([
      checkBotId().catch(() => null),
      auth.api.getSession({ headers: await headers() }),
    ]);

    if (!session?.user) {
      return new ChatbotError("unauthorized:chat").toResponse();
    }

    const chatModel = allowedModelIds.has(selectedChatModel)
      ? selectedChatModel
      : DEFAULT_CHAT_MODEL;

    await checkIpRateLimit(ipAddress(request));

    const isAnonymous = session.user.isAnonymous ?? false;

    const messageCount = await getMessageCountByUserId({
      id: session.user.id,
      differenceInHours: 1,
    });

    if (
      messageCount >
      entitlementsByIsAnonymous[isAnonymous ? "true" : "false"]
        .maxMessagesPerHour
    ) {
      return new ChatbotError("rate_limit:chat").toResponse();
    }

    const isToolApprovalFlow = Boolean(messages);

    const chat = await getChatById({ id });
    let messagesFromDb: DBMessage[] = [];
    let titlePromise: Promise<string> | null = null;

    if (chat) {
      if (chat.userId !== session.user.id) {
        return new ChatbotError("forbidden:chat").toResponse();
      }
      messagesFromDb = await getMessagesByChatId({ id });
    } else if (message?.role === "user") {
      await saveChat({
        id,
        userId: session.user.id,
        title: "New chat",
        visibility: selectedVisibilityType,
      });
      titlePromise = generateTitleFromUserMessage({ message });
    }

    let uiMessages: ChatMessage[];

    if (isToolApprovalFlow && messages) {
      const dbMessages = convertToUIMessages(messagesFromDb);
      const approvalStates = new Map(
        messages.flatMap(
          (m) =>
            m.parts
              ?.filter(
                (p: Record<string, unknown>) =>
                  p.state === "approval-responded" ||
                  p.state === "output-denied"
              )
              .map((p: Record<string, unknown>) => [
                String(p.toolCallId ?? ""),
                p,
              ]) ?? []
        )
      );
      uiMessages = dbMessages.map((msg) => ({
        ...msg,
        parts: msg.parts.map((part) => {
          if (
            "toolCallId" in part &&
            approvalStates.has(String(part.toolCallId))
          ) {
            return { ...part, ...approvalStates.get(String(part.toolCallId)) };
          }
          return part;
        }),
      })) as ChatMessage[];
    } else {
      uiMessages = [
        ...convertToUIMessages(messagesFromDb),
        message as ChatMessage,
      ];
    }

    const { longitude, latitude, city, country } = geolocation(request);

    const requestHints: RequestHints = {
      longitude,
      latitude,
      city,
      country,
    };

    if (message?.role === "user") {
      await saveMessages({
        messages: [
          {
            chatId: id,
            id: message.id,
            role: "user",
            parts: message.parts,
            attachments: [],
            createdAt: new Date(),
          },
        ],
      });
    }

    // Load user memories for Ruhi's system prompt
    const memoriesBlock = await loadAndFormatMemories(session.user.id);

    // Build Ruhi system prompt with memories + geo hints
    const requestPrompt = getRequestPromptFromHints(requestHints);
    const ruhiInstructions = buildRuhiSystemPrompt(undefined, memoriesBlock ?? undefined)
      + `\n\n## Internal Context\nThe current user's database ID is: ${session.user.id}\nAlways use this exact ID when calling tools like getCycleContext, logCycle, getScanHistory, or saveMemory.`
      + `\n\n${requestPrompt}`;

    const modelConfig = chatModels.find((m) => m.id === chatModel);
    const capabilities = modelConfig?.capabilities;
    const isReasoningModel = capabilities?.reasoning === true;
    const supportsTools = capabilities?.tools === true;

    const modelMessages = await convertToModelMessages(uiMessages);

    const ruhiTools = { getCycleContext, logCycle, getScanHistory, saveMemory };

    const cfg = {
      model: getLanguageModel(chatModel),
      instructions: ruhiInstructions,
      activeTools:
        isReasoningModel && !supportsTools
          ? []
          : Object.keys(ruhiTools),
      providerOptions: {
        ...(modelConfig?.reasoningEffort && {
          openai: { reasoningEffort: modelConfig.reasoningEffort },
        }),
      },
    };

    const stream = createUIMessageStream({
      originalMessages: isToolApprovalFlow ? uiMessages : undefined,
      execute: async ({ writer: dataStream }) => {
        // Check for image attachments in the latest user message
        const lastUserMessage = uiMessages.filter(m => m.role === "user").pop();
        const imageParts = lastUserMessage?.parts?.filter(
          (p: any) => p.type === "file" && p.mediaType?.startsWith("image/")
        ) ?? [];

        let scanContext = "";

        if (imageParts.length > 0) {
          const imageUrl = (imageParts[0] as any).url;
          try {
            const imageResponse = await fetch(imageUrl);
            const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
            const imageBase64 = imageBuffer.toString("base64");

            const { scanResult, comparisonBlock } = await runScanPipeline({
              imageData: imageBase64,
              userId: session.user.id,
              imageUrl,
            });

            if (scanResult) {
              const scanData = JSON.stringify(scanResult, null, 2);
              scanContext = `Here are the clinical skin scan results for the photo the user just sent. Interpret them in your style — what's good, what needs attention, and what should they do:\n\n${scanData}`;
              if (comparisonBlock) {
                scanContext += `\n\n${comparisonBlock}`;
              }
            }
          } catch (err) {
            console.error("[ScanPipeline] Web chat scan failed:", err);
          }
        }

        // If we have scan results, append them to the last user message for Ruhi to interpret
        const agentMessages = scanContext
          ? (() => {
              const msgs = [...modelMessages];
              const lastMsg = msgs[msgs.length - 1];
              if (lastMsg && lastMsg.role === "user") {
                msgs[msgs.length - 1] = {
                  ...lastMsg,
                  content: Array.isArray(lastMsg.content)
                    ? [...lastMsg.content, { type: "text" as const, text: scanContext }]
                    : [{ type: "text" as const, text: String(lastMsg.content) }, { type: "text" as const, text: scanContext }],
                };
              }
              return msgs;
            })()
          : modelMessages;

        const agent = createChatAgent({
          ...cfg,
          tools: ruhiTools,
        });

        const result = await agent.stream({ messages: agentMessages });
        dataStream.merge(
          result.toUIMessageStream({ sendReasoning: isReasoningModel })
        );

        if (titlePromise) {
          const title = await titlePromise;
          dataStream.write({ type: "data-chat-title", data: title });
          updateChatTitleById({ chatId: id, title });
        }
      },
      generateId: generateUUID,
      onFinish: async ({ messages: finishedMessages }) => {
        if (isToolApprovalFlow) {
          for (const finishedMsg of finishedMessages) {
            const existingMsg = uiMessages.find((m) => m.id === finishedMsg.id);
            if (existingMsg) {
              await updateMessage({
                id: finishedMsg.id,
                parts: finishedMsg.parts,
              });
            } else {
              await saveMessages({
                messages: [
                  {
                    id: finishedMsg.id,
                    role: finishedMsg.role,
                    parts: finishedMsg.parts,
                    createdAt: new Date(),
                    attachments: [],
                    chatId: id,
                  },
                ],
              });
            }
          }
        } else if (finishedMessages.length > 0) {
          await saveMessages({
            messages: finishedMessages.map((currentMessage) => ({
              id: currentMessage.id,
              role: currentMessage.role,
              parts: currentMessage.parts,
              createdAt: new Date(),
              attachments: [],
              chatId: id,
            })),
          });
        }

        // Post-hoc safety net: catch identity facts the LLM may have missed
        const lastUserMsg = uiMessages.filter(m => m.role === "user").pop();
        if (lastUserMsg) {
          const userText = lastUserMsg.parts
            ?.filter((p: any) => p.type === "text")
            .map((p: any) => p.text)
            .join("") ?? "";
          if (userText) {
            runPostHocSafetyNet(session.user.id, userText).catch((err) =>
              console.error("[SafetyNet] Web chat:", err),
            );
          }
        }
      },
      onError: () => {
        return "Oops, an error occurred!";
      },
    });

    return createUIMessageStreamResponse({
      stream,
      async consumeSseStream({ stream: sseStream }) {
        if (!env.REDIS_URL) {
          return;
        }
        try {
          const streamContext = getStreamContext();
          if (streamContext) {
            const streamId = generateId();
            await createStreamId({ streamId, chatId: id });
            await streamContext.createNewResumableStream(
              streamId,
              () => sseStream
            );
          }
        } catch (_) {
          /* non-critical */
        }
      },
    });
  } catch (error) {
    const vercelId = request.headers.get("x-vercel-id");

    if (error instanceof ChatbotError) {
      return error.toResponse();
    }

    console.error("Unhandled error in chat API:", error, { vercelId });
    return new ChatbotError("offline:chat").toResponse();
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return new ChatbotError("bad_request:api").toResponse();
  }

  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }

  const chat = await getChatById({ id });

  if (chat?.userId !== session.user.id) {
    return new ChatbotError("forbidden:chat").toResponse();
  }

  const deletedChat = await deleteChatById({ id });

  return Response.json(deletedChat, { status: 200 });
}
