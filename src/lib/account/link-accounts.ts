import { eq } from "drizzle-orm";

import { db } from "@/db/queries";
import {
  chat,
  cycle,
  memory,
  proactiveLog,
  scan,
  user,
} from "@/db/schema";

/**
 * Transactionally migrates all data from a Telegram-only user to a web user,
 * then deletes the orphaned Telegram user row.
 *
 * Duplicate identity/preference memories are skipped — the web user's value wins.
 */
export async function linkAccounts(
  webUserId: string,
  telegramUserId: string,
  telegramId: bigint,
) {
  await db.transaction(async (tx) => {
    // 1. Move memories — skip duplicates for identity/preference with same key
    const existingMemories = await tx
      .select({ category: memory.category, key: memory.key })
      .from(memory)
      .where(eq(memory.userId, webUserId));

    const existingKeys = new Set(
      existingMemories.map((m) => `${m.category}:${m.key ?? ""}`),
    );

    const telegramMemories = await tx
      .select()
      .from(memory)
      .where(eq(memory.userId, telegramUserId));

    for (const mem of telegramMemories) {
      const key = `${mem.category}:${mem.key ?? ""}`;
      if (
        (mem.category === "identity" || mem.category === "preference") &&
        existingKeys.has(key)
      ) {
        continue; // Web user's value wins
      }
      await tx
        .update(memory)
        .set({ userId: webUserId })
        .where(eq(memory.id, mem.id));
    }
    // Delete remaining duplicates that weren't moved
    await tx.delete(memory).where(eq(memory.userId, telegramUserId));

    // 2. Move scans
    await tx
      .update(scan)
      .set({ userId: webUserId })
      .where(eq(scan.userId, telegramUserId));

    // 3. Move cycles
    await tx
      .update(cycle)
      .set({ userId: webUserId })
      .where(eq(cycle.userId, telegramUserId));

    // 4. Move proactive_log
    await tx
      .update(proactiveLog)
      .set({ userId: webUserId })
      .where(eq(proactiveLog.userId, telegramUserId));

    // 5. Move chats
    await tx
      .update(chat)
      .set({ userId: webUserId })
      .where(eq(chat.userId, telegramUserId));

    // Note: telegram_messages has no userId column (keyed by telegramChatId),
    // so no migration is needed for that table.

    // 6. Set telegramId on web user
    await tx
      .update(user)
      .set({ telegramId, updatedAt: new Date() })
      .where(eq(user.id, webUserId));

    // 7. Delete orphan Telegram user (cascade handles sessions/accounts)
    await tx.delete(user).where(eq(user.id, telegramUserId));
  });
}
