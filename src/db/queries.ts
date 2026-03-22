import "server-only";

import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNull,
  lt,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { VisibilityType } from "@/components/chat/visibility-selector";
import { env } from "@/lib/env";
import { ChatbotError } from "@/lib/errors";
import {
  type Chat,
  chat,
  cycle,
  type DBMessage,
  linkCode,
  memory,
  message,
  proactiveLog,
  scan,
  stream,
  telegramMessage,
  user,
  vote,
} from "./schema";

// --------------------------------------------------------------------
// src/db/queries.ts
//
// const client                                                    L108
// export const db                                                 L109
// export async function saveChat()                                L111
// id                                                              L117
// userId                                                          L118
// title                                                           L119
// visibility                                                      L120
// export async function deleteChatById()                          L135
// id                                                              L135
// export async function deleteAllChatsByUserId()                  L154
// userId                                                          L154
// export async function getChatsByUserId()                        L185
// id                                                              L191
// limit                                                           L192
// startingAfter                                                   L193
// endingBefore                                                    L194
// export async function getChatById()                             L261
// id                                                              L261
// messages                                                        L274
// export async function saveMessages()                            L274
// export async function updateMessage()                           L282
// id                                                              L286
// parts                                                           L287
// export async function getMessagesByChatId()                     L296
// id                                                              L296
// export async function voteMessage()                             L311
// chatId                                                          L316
// messageId                                                       L317
// type                                                            L318
// export async function getVotesByChatId()                        L342
// id                                                              L342
// export async function saveDocument()                            L353
// id                                                              L360
// title                                                           L361
// kind                                                            L362
// content                                                         L363
// userId                                                          L364
// export async function updateDocumentContent()                   L383
// id                                                              L387
// content                                                         L388
// export async function getDocumentsById()                        L419
// id                                                              L419
// export async function getDocumentById()                         L436
// id                                                              L436
// export async function deleteDocumentsByIdAfterTimestamp()       L453
// id                                                              L457
// timestamp                                                       L458
// export async function saveSuggestions()                         L482
// suggestions                                                     L485
// export async function getSuggestionsByDocumentId()              L497
// documentId                                                      L500
// export async function getMessageById()                          L515
// id                                                              L515
// export async function deleteMessagesByChatIdAfterTimestamp()    L526
// chatId                                                          L530
// timestamp                                                       L531
// export async function updateChatVisibilityById()                L566
// chatId                                                          L570
// visibility                                                      L571
// export async function updateChatTitleById()                     L583
// chatId                                                          L587
// title                                                           L588
// export async function getMessageCountByUserId()                 L597
// id                                                              L601
// differenceInHours                                               L602
// export async function createStreamId()                          L631
// streamId                                                        L635
// chatId                                                          L636
// chatId                                                          L650
// export async function getStreamIdsByChatId()                    L650
// --------------------------------------------------------------------

const client = postgres(env.DATABASE_URL!);
export const db = drizzle(client);

export async function saveChat({
  id,
  userId,
  title,
  visibility,
}: {
  id: string;
  userId: string;
  title: string;
  visibility: VisibilityType;
}) {
  try {
    return await db.insert(chat).values({
      id,
      createdAt: new Date(),
      userId,
      title,
      visibility,
    });
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to save chat");
  }
}

export async function deleteChatById({ id }: { id: string }) {
  try {
    await db.delete(vote).where(eq(vote.chatId, id));
    await db.delete(message).where(eq(message.chatId, id));
    await db.delete(stream).where(eq(stream.chatId, id));

    const [chatsDeleted] = await db
      .delete(chat)
      .where(eq(chat.id, id))
      .returning();
    return chatsDeleted;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to delete chat by id"
    );
  }
}

export async function deleteAllChatsByUserId({ userId }: { userId: string }) {
  try {
    const userChats = await db
      .select({ id: chat.id })
      .from(chat)
      .where(eq(chat.userId, userId));

    if (userChats.length === 0) {
      return { deletedCount: 0 };
    }

    const chatIds = userChats.map((c) => c.id);

    await db.delete(vote).where(inArray(vote.chatId, chatIds));
    await db.delete(message).where(inArray(message.chatId, chatIds));
    await db.delete(stream).where(inArray(stream.chatId, chatIds));

    const deletedChats = await db
      .delete(chat)
      .where(eq(chat.userId, userId))
      .returning();

    return { deletedCount: deletedChats.length };
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to delete all chats by user id"
    );
  }
}

export async function getChatsByUserId({
  id,
  limit,
  startingAfter,
  endingBefore,
}: {
  id: string;
  limit: number;
  startingAfter: string | null;
  endingBefore: string | null;
}) {
  try {
    const extendedLimit = limit + 1;

    const query = (whereCondition?: SQL<unknown>) =>
      db
        .select()
        .from(chat)
        .where(
          whereCondition
            ? and(whereCondition, eq(chat.userId, id))
            : eq(chat.userId, id)
        )
        .orderBy(desc(chat.createdAt))
        .limit(extendedLimit);

    let filteredChats: Chat[] = [];

    if (startingAfter) {
      const [selectedChat] = await db
        .select()
        .from(chat)
        .where(eq(chat.id, startingAfter))
        .limit(1);

      if (!selectedChat) {
        throw new ChatbotError(
          "not_found:database",
          `Chat with id ${startingAfter} not found`
        );
      }

      filteredChats = await query(gt(chat.createdAt, selectedChat.createdAt));
    } else if (endingBefore) {
      const [selectedChat] = await db
        .select()
        .from(chat)
        .where(eq(chat.id, endingBefore))
        .limit(1);

      if (!selectedChat) {
        throw new ChatbotError(
          "not_found:database",
          `Chat with id ${endingBefore} not found`
        );
      }

      filteredChats = await query(lt(chat.createdAt, selectedChat.createdAt));
    } else {
      filteredChats = await query();
    }

    const hasMore = filteredChats.length > limit;

    return {
      chats: hasMore ? filteredChats.slice(0, limit) : filteredChats,
      hasMore,
    };
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get chats by user id"
    );
  }
}

export async function getChatById({ id }: { id: string }) {
  try {
    const [selectedChat] = await db.select().from(chat).where(eq(chat.id, id));
    if (!selectedChat) {
      return null;
    }

    return selectedChat;
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to get chat by id");
  }
}

export async function saveMessages({ messages }: { messages: DBMessage[] }) {
  try {
    return await db.insert(message).values(messages);
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to save messages");
  }
}

export async function updateMessage({
  id,
  parts,
}: {
  id: string;
  parts: DBMessage["parts"];
}) {
  try {
    return await db.update(message).set({ parts }).where(eq(message.id, id));
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to update message");
  }
}

export async function getMessagesByChatId({ id }: { id: string }) {
  try {
    return await db
      .select()
      .from(message)
      .where(eq(message.chatId, id))
      .orderBy(asc(message.createdAt));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get messages by chat id"
    );
  }
}

export async function voteMessage({
  chatId,
  messageId,
  type,
}: {
  chatId: string;
  messageId: string;
  type: "up" | "down";
}) {
  try {
    const [existingVote] = await db
      .select()
      .from(vote)
      .where(and(eq(vote.messageId, messageId)));

    if (existingVote) {
      return await db
        .update(vote)
        .set({ isUpvoted: type === "up" })
        .where(and(eq(vote.messageId, messageId), eq(vote.chatId, chatId)));
    }
    return await db.insert(vote).values({
      chatId,
      messageId,
      isUpvoted: type === "up",
    });
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to vote message");
  }
}

export async function getVotesByChatId({ id }: { id: string }) {
  try {
    return await db.select().from(vote).where(eq(vote.chatId, id));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get votes by chat id"
    );
  }
}


export async function getMessageById({ id }: { id: string }) {
  try {
    return await db.select().from(message).where(eq(message.id, id));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get message by id"
    );
  }
}

export async function deleteMessagesByChatIdAfterTimestamp({
  chatId,
  timestamp,
}: {
  chatId: string;
  timestamp: Date;
}) {
  try {
    const messagesToDelete = await db
      .select({ id: message.id })
      .from(message)
      .where(
        and(eq(message.chatId, chatId), gte(message.createdAt, timestamp))
      );

    const messageIds = messagesToDelete.map(
      (currentMessage) => currentMessage.id
    );

    if (messageIds.length > 0) {
      await db
        .delete(vote)
        .where(
          and(eq(vote.chatId, chatId), inArray(vote.messageId, messageIds))
        );

      return await db
        .delete(message)
        .where(
          and(eq(message.chatId, chatId), inArray(message.id, messageIds))
        );
    }
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to delete messages by chat id after timestamp"
    );
  }
}

export async function updateChatVisibilityById({
  chatId,
  visibility,
}: {
  chatId: string;
  visibility: "private" | "public";
}) {
  try {
    return await db.update(chat).set({ visibility }).where(eq(chat.id, chatId));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to update chat visibility by id"
    );
  }
}

export async function updateChatTitleById({
  chatId,
  title,
}: {
  chatId: string;
  title: string;
}) {
  try {
    return await db.update(chat).set({ title }).where(eq(chat.id, chatId));
  } catch (_error) {
    return;
  }
}

export async function getMessageCountByUserId({
  id,
  differenceInHours,
}: {
  id: string;
  differenceInHours: number;
}) {
  try {
    const cutoffTime = new Date(
      Date.now() - differenceInHours * 60 * 60 * 1000
    );

    const [stats] = await db
      .select({ count: count(message.id) })
      .from(message)
      .innerJoin(chat, eq(message.chatId, chat.id))
      .where(
        and(
          eq(chat.userId, id),
          gte(message.createdAt, cutoffTime),
          eq(message.role, "user")
        )
      )
      .execute();

    return stats?.count ?? 0;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get message count by user id"
    );
  }
}

export async function createStreamId({
  streamId,
  chatId,
}: {
  streamId: string;
  chatId: string;
}) {
  try {
    await db
      .insert(stream)
      .values({ id: streamId, chatId, createdAt: new Date() });
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to create stream id"
    );
  }
}

export async function getStreamIdsByChatId({ chatId }: { chatId: string }) {
  try {
    const streamIds = await db
      .select({ id: stream.id })
      .from(stream)
      .where(eq(stream.chatId, chatId))
      .orderBy(asc(stream.createdAt))
      .execute();

    return streamIds.map(({ id }) => id);
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get stream ids by chat id"
    );
  }
}

// ---- Cycle queries ----

export async function getLatestCycle({ userId }: { userId: string }) {
  try {
    const [latest] = await db
      .select()
      .from(cycle)
      .where(eq(cycle.userId, userId))
      .orderBy(desc(cycle.periodStart))
      .limit(1);
    return latest ?? null;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get latest cycle"
    );
  }
}

export async function insertCycle({
  userId,
  periodStart,
  cycleLength,
}: {
  userId: string;
  periodStart: Date;
  cycleLength: number;
}) {
  try {
    const [inserted] = await db
      .insert(cycle)
      .values({ userId, periodStart, cycleLength })
      .returning();
    return inserted;
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to insert cycle");
  }
}

// ---- Scan queries ----

export async function getRecentScans({
  userId,
  limit = 10,
}: {
  userId: string;
  limit?: number;
}) {
  try {
    return await db
      .select()
      .from(scan)
      .where(eq(scan.userId, userId))
      .orderBy(desc(scan.createdAt))
      .limit(limit);
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get recent scans"
    );
  }
}

export async function insertScan(data: {
  userId: string;
  conversationId?: string;
  scanType?: string;
  imageUrl?: string;
  results: Record<string, unknown>;
  cycleDay?: number;
  cyclePhase?: string;
}) {
  try {
    const [inserted] = await db
      .insert(scan)
      .values({
        userId: data.userId,
        conversationId: data.conversationId ?? null,
        scanType: data.scanType ?? "face",
        imageUrl: data.imageUrl ?? null,
        results: data.results,
        cycleDay: data.cycleDay ?? null,
        cyclePhase: data.cyclePhase ?? null,
      })
      .returning();
    return inserted;
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to insert scan");
  }
}

// ---- Telegram user queries ----

export async function getUserByTelegramId({
  telegramId,
}: {
  telegramId: bigint;
}) {
  try {
    const [found] = await db
      .select()
      .from(user)
      .where(eq(user.telegramId, telegramId))
      .limit(1);
    return found ?? null;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get user by telegram id"
    );
  }
}

export async function upsertTelegramUser({
  telegramId,
  username,
}: {
  telegramId: bigint;
  username?: string;
}) {
  try {
    const existing = await getUserByTelegramId({ telegramId });
    if (existing) {
      if (username && existing.telegramUsername !== username) {
        await db
          .update(user)
          .set({ telegramUsername: username, updatedAt: new Date() })
          .where(eq(user.id, existing.id));
      }
      return existing;
    }

    const { nanoid } = await import("nanoid");
    const [created] = await db
      .insert(user)
      .values({
        id: nanoid(),
        email: `tg_${telegramId.toString()}@telegram.local`,
        telegramId,
        telegramUsername: username ?? null,
        isAnonymous: true,
      })
      .returning();
    return created;
  } catch (error) {
    if (error instanceof ChatbotError) throw error;
    throw new ChatbotError(
      "bad_request:database",
      "Failed to upsert telegram user"
    );
  }
}

// ---- Conversation helpers for Telegram ----

export async function getOrCreateConversation({
  userId,
}: {
  userId: string;
}) {
  try {
    // Find an existing conversation for this user
    const [existing] = await db
      .select()
      .from(chat)
      .where(eq(chat.userId, userId))
      .orderBy(desc(chat.createdAt))
      .limit(1);

    if (existing) return existing;

    // Create a new conversation
    const [created] = await db
      .insert(chat)
      .values({
        createdAt: new Date(),
        title: "Ruhi Skincare Chat",
        userId,
        visibility: "private",
      })
      .returning();
    return created;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get or create conversation"
    );
  }
}

export async function getRecentMessages({
  conversationId,
  limit = 20,
}: {
  conversationId: string;
  limit?: number;
}) {
  try {
    return await db
      .select()
      .from(message)
      .where(eq(message.chatId, conversationId))
      .orderBy(asc(message.createdAt))
      .limit(limit);
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get recent messages"
    );
  }
}

export async function saveMessage({
  conversationId,
  role,
  content,
}: {
  conversationId: string;
  role: string;
  content: string;
}) {
  try {
    const [inserted] = await db
      .insert(message)
      .values({
        chatId: conversationId,
        role,
        parts: [{ type: "text", text: content }],
        attachments: [],
        createdAt: new Date(),
      })
      .returning();
    return inserted;
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to save message");
  }
}

// ---- Telegram Messages (plain text, no JSON parts) ----

export async function saveTelegramMessage({
  telegramChatId,
  role,
  content,
}: {
  telegramChatId: number;
  role: string;
  content: string;
}) {
  const [inserted] = await db
    .insert(telegramMessage)
    .values({ telegramChatId, role, content })
    .returning();
  return inserted;
}

export async function getTelegramHistory({
  telegramChatId,
  limit = 20,
}: {
  telegramChatId: number;
  limit?: number;
}) {
  return db
    .select()
    .from(telegramMessage)
    .where(eq(telegramMessage.telegramChatId, telegramChatId))
    .orderBy(asc(telegramMessage.createdAt))
    .limit(limit);
}

export async function clearTelegramHistory({
  telegramChatId,
}: {
  telegramChatId: number;
}) {
  await db
    .delete(telegramMessage)
    .where(eq(telegramMessage.telegramChatId, telegramChatId));
}

// ---- Memory queries (Sprint 2) ----

export async function upsertMemory({
  userId,
  category,
  key,
  value,
  metadata,
}: {
  userId: string;
  category: "identity" | "preference";
  key: string;
  value: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    const [result] = await db
      .insert(memory)
      .values({
        userId,
        category,
        key,
        value,
        metadata: metadata ?? {},
      })
      .onConflictDoUpdate({
        target: [memory.userId, memory.category, memory.key],
        targetWhere: sql`${memory.key} IS NOT NULL`,
        set: {
          value,
          metadata: metadata ?? {},
          updatedAt: new Date(),
        },
      })
      .returning();
    return result;
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to upsert memory");
  }
}

export async function insertMemory({
  userId,
  category,
  value,
  metadata,
  expiresAt,
}: {
  userId: string;
  category: "health" | "context";
  value: string;
  metadata?: Record<string, unknown>;
  expiresAt?: Date;
}) {
  try {
    const [result] = await db
      .insert(memory)
      .values({
        userId,
        category,
        key: null,
        value,
        metadata: metadata ?? {},
        expiresAt: expiresAt ?? null,
      })
      .returning();
    return result;
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to insert memory");
  }
}

export async function insertMomentMemory({
  userId,
  value,
  metadata,
}: {
  userId: string;
  value: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    return await db.transaction(async (tx) => {
      // Lock rows for this user's moments to prevent race conditions.
      // SELECT ... FOR UPDATE can't use aggregate functions, so we select
      // the IDs directly and count in JS.
      const lockedRows = await tx
        .select({ id: memory.id, createdAt: memory.createdAt })
        .from(memory)
        .where(and(eq(memory.userId, userId), eq(memory.category, "moment")))
        .orderBy(asc(memory.createdAt))
        .for("update");

      // If at cap, delete the oldest moment
      if (lockedRows.length >= 30) {
        await tx.delete(memory).where(eq(memory.id, lockedRows[0].id));
      }

      // Insert the new moment
      const [result] = await tx
        .insert(memory)
        .values({
          userId,
          category: "moment",
          key: null,
          value,
          metadata: metadata ?? {},
        })
        .returning();

      return result;
    });
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to insert moment memory",
    );
  }
}

export async function loadMemories({ userId }: { userId: string }) {
  try {
    return await db
      .select()
      .from(memory)
      .where(
        and(
          eq(memory.userId, userId),
          or(isNull(memory.expiresAt), gt(memory.expiresAt, new Date())),
        ),
      )
      .orderBy(memory.category, desc(memory.createdAt))
      .limit(200);
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to load memories");
  }
}

export async function deleteExpiredMemories() {
  try {
    const result = await db
      .delete(memory)
      .where(
        and(
          sql`${memory.expiresAt} IS NOT NULL`,
          lt(memory.expiresAt, new Date()),
        ),
      )
      .returning({ id: memory.id });
    return result.length;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to delete expired memories",
    );
  }
}

export async function findMemoryByKey({
  userId,
  category,
  key,
}: {
  userId: string;
  category: "identity" | "health" | "preference" | "moment" | "context";
  key: string;
}) {
  try {
    const [found] = await db
      .select({ id: memory.id, value: memory.value })
      .from(memory)
      .where(
        and(
          eq(memory.userId, userId),
          eq(memory.category, category),
          eq(memory.key, key),
        ),
      )
      .limit(1);
    return found ?? null;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to find memory by key",
    );
  }
}

// ---- Proactive messaging queries (Sprint 3B) ----

export async function logProactiveMessage({
  userId,
  type,
  referenceId,
  message: msg,
}: {
  userId: string;
  type: "product_followup" | "scan_nudge" | "weather_tip";
  referenceId?: string;
  message: string;
}) {
  try {
    const [result] = await db
      .insert(proactiveLog)
      .values({
        userId,
        type,
        referenceId: referenceId ?? null,
        message: msg,
      })
      .returning();
    return result;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to log proactive message",
    );
  }
}

export async function getProactiveCountSince({
  userId,
  since,
}: {
  userId: string;
  since: Date;
}) {
  try {
    const [result] = await db
      .select({ total: count(proactiveLog.id) })
      .from(proactiveLog)
      .where(
        and(
          eq(proactiveLog.userId, userId),
          gte(proactiveLog.sentAt, since),
        ),
      );
    return result?.total ?? 0;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get proactive count",
    );
  }
}

export async function getNudgeCountForReference({
  userId,
  type,
  referenceId,
}: {
  userId: string;
  type: "product_followup" | "scan_nudge" | "weather_tip";
  referenceId: string;
}) {
  try {
    const [result] = await db
      .select({ total: count(proactiveLog.id) })
      .from(proactiveLog)
      .where(
        and(
          eq(proactiveLog.userId, userId),
          eq(proactiveLog.type, type),
          eq(proactiveLog.referenceId, referenceId),
        ),
      );
    return result?.total ?? 0;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get nudge count",
    );
  }
}

export async function getScanNudgeCountSince({
  userId,
  since,
}: {
  userId: string;
  since: Date;
}) {
  try {
    const [result] = await db
      .select({ total: count(proactiveLog.id) })
      .from(proactiveLog)
      .where(
        and(
          eq(proactiveLog.userId, userId),
          eq(proactiveLog.type, "scan_nudge"),
          gte(proactiveLog.sentAt, since),
        ),
      );
    return result?.total ?? 0;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get scan nudge count",
    );
  }
}

export async function getUserLastMessageTime({
  userId,
}: {
  userId: string;
}) {
  try {
    // Get the user's telegramId to look up telegram_messages
    const [dbUser] = await db
      .select({ telegramId: user.telegramId })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    if (!dbUser?.telegramId) return null;

    const telegramChatId = Number(dbUser.telegramId);
    const [latest] = await db
      .select({ createdAt: telegramMessage.createdAt })
      .from(telegramMessage)
      .where(
        and(
          eq(telegramMessage.telegramChatId, telegramChatId),
          eq(telegramMessage.role, "user"),
        ),
      )
      .orderBy(desc(telegramMessage.createdAt))
      .limit(1);

    return latest?.createdAt ?? null;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get user last message time",
    );
  }
}

export async function getRecommendationMemories({
  userId,
}: {
  userId: string;
}) {
  try {
    return await db
      .select()
      .from(memory)
      .where(
        and(
          eq(memory.userId, userId),
          eq(memory.category, "health"),
          sql`${memory.metadata}->>'status' = 'recommended'`,
        ),
      )
      .orderBy(desc(memory.createdAt));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get recommendation memories",
    );
  }
}

export async function getAllProactiveEligibleUsers() {
  try {
    // Get all users who have a telegramId (telegram users) and haven't opted out
    const users = await db
      .select({
        id: user.id,
        telegramId: user.telegramId,
      })
      .from(user)
      .where(sql`${user.telegramId} IS NOT NULL`);

    // Filter out users who have proactive paused
    const result: Array<{ id: string; telegramId: bigint }> = [];
    for (const u of users) {
      if (!u.telegramId) continue;
      const pausedMemory = await findMemoryByKey({
        userId: u.id,
        category: "preference",
        key: "proactive",
      });
      if (pausedMemory?.value === "paused") continue;
      result.push({ id: u.id, telegramId: u.telegramId });
    }

    return result;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get proactive eligible users",
    );
  }
}

// ---- Link code queries (Sprint 5B) ----

function generateLinkCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I confusion
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function createLinkCode({ userId }: { userId: string }) {
  // Delete any existing unused codes for this user
  await db
    .delete(linkCode)
    .where(and(eq(linkCode.userId, userId), isNull(linkCode.usedAt)));

  const code = generateLinkCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  const [result] = await db
    .insert(linkCode)
    .values({ userId, code, expiresAt })
    .returning();

  return result;
}

export async function findValidLinkCode({ code }: { code: string }) {
  const [result] = await db
    .select()
    .from(linkCode)
    .where(
      and(
        eq(linkCode.code, code.toUpperCase()),
        isNull(linkCode.usedAt),
        gt(linkCode.expiresAt, new Date()),
      )
    );

  return result ?? null;
}

export async function markLinkCodeUsed({ id }: { id: string }) {
  await db
    .update(linkCode)
    .set({ usedAt: new Date() })
    .where(eq(linkCode.id, id));
}

export async function getLinkStatus({ userId }: { userId: string }) {
  const [u] = await db
    .select({ telegramId: user.telegramId })
    .from(user)
    .where(eq(user.id, userId));

  return { linked: u?.telegramId != null };
}
