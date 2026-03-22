# Sprint 5B: Account Linking (Telegram ↔ Web) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Users can link their Telegram and web accounts so memories, scans, cycles, and chat history are unified under one user record.

**Architecture:** Web user generates a 6-character link code (stored in a new `link_codes` table with 10-minute expiry). User sends `/link CODE` to Ruhi on Telegram. The handler validates the code and runs a transactional data migration — moving all data from the Telegram user to the web user, setting `telegramId` on the web user, and deleting the orphan Telegram user record.

**Tech Stack:** Next.js App Router, Drizzle ORM (PostgreSQL), BetterAuth sessions

**Spec:** `docs/specs/2026-03-21-account-linking-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/db/schema.ts` | Modify | Add `linkCode` table definition |
| `src/db/queries.ts` | Modify | Add link code CRUD queries |
| `src/lib/account/link-accounts.ts` | Create | Transactional data migration logic |
| `src/app/(chat)/api/link-telegram/route.ts` | Create | API: generate code, check link status |
| `src/app/(chat)/link-telegram/page.tsx` | Create | UI: link page with code display |
| `src/lib/telegram/handler.ts` | Modify | Add `/link CODE` command handler |
| Migration file | Create | Add `link_codes` table to DB |

---

## Task 1: Add link_codes table to DB schema

**Files:**
- Modify: `src/db/schema.ts`

- [ ] **Step 1: Add the linkCode table definition**

In `src/db/schema.ts`, after the `proactiveLog` table definition, add:

```typescript
export const linkCode = pgTable("link_codes", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  code: varchar("code", { length: 6 }).notNull().unique(),
  expiresAt: timestamp("expiresAt").notNull(),
  usedAt: timestamp("usedAt"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export type LinkCode = typeof linkCode.$inferSelect;
```

Add the `varchar` import at the top if not already present:
```typescript
import { ..., varchar } from "drizzle-orm/pg-core";
```

- [ ] **Step 2: Generate the migration**

Run: `npx drizzle-kit generate`
Expected: A new migration file in the migrations directory

- [ ] **Step 3: Run the migration**

Run: `npx drizzle-kit push` (or `npx drizzle-kit migrate` depending on project setup)
Expected: `link_codes` table created in the database

- [ ] **Step 4: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 5: Commit**

```bash
git add src/db/schema.ts drizzle/
git commit -m "feat(5B): add link_codes table schema and migration"
```

---

## Task 2: Add link code queries

**Files:**
- Modify: `src/db/queries.ts`

- [ ] **Step 1: Add link code query functions**

Add these functions to `src/db/queries.ts`:

```typescript
import { linkCode } from "./schema";

// Generate a random 6-character alphanumeric code
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
  // Check if user already has a telegramId linked
  const [u] = await db
    .select({ telegramId: user.telegramId })
    .from(user)
    .where(eq(user.id, userId));

  return { linked: u?.telegramId !== null };
}
```

Make sure `and`, `isNull`, `gt` are imported from `drizzle-orm` (they may already be imported).

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add src/db/queries.ts
git commit -m "feat(5B): add link code CRUD queries"
```

---

## Task 3: Create account linking migration logic

**Files:**
- Create: `src/lib/account/link-accounts.ts`

- [ ] **Step 1: Create the transactional migration function**

```typescript
// src/lib/account/link-accounts.ts

import { db } from "@/db/queries";
import {
  user,
  memory,
  scan,
  cycle,
  telegramMessage,
  proactiveLog,
  chat,
  message,
} from "@/db/schema";
import { eq, sql } from "drizzle-orm";

/**
 * Link a Telegram user account to a web user account.
 * Migrates all data from the Telegram user to the web user
 * and deletes the orphan Telegram user record.
 *
 * Must be called inside a transaction context or wraps its own.
 */
export async function linkAccounts(
  webUserId: string,
  telegramUserId: string,
  telegramId: bigint,
) {
  await db.transaction(async (tx) => {
    // 1. Move memories (skip duplicates for identity/preference with same key)
    const existingMemories = await tx
      .select({ category: memory.category, key: memory.key })
      .from(memory)
      .where(eq(memory.userId, webUserId));

    const existingKeys = new Set(
      existingMemories.map((m) => `${m.category}:${m.key ?? ""}`)
    );

    // Update non-conflicting memories
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
        // Skip — web user's value wins for identity/preference collisions
        continue;
      }
      await tx
        .update(memory)
        .set({ userId: webUserId })
        .where(eq(memory.id, mem.id));
    }

    // Delete remaining Telegram user memories (the duplicates we skipped)
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

    // 4. Move telegram_messages (update userId, keep telegramChatId)
    await tx
      .update(telegramMessage)
      .set({ userId: webUserId })
      .where(eq(telegramMessage.userId, telegramUserId));

    // 5. Move proactive_log
    await tx
      .update(proactiveLog)
      .set({ userId: webUserId })
      .where(eq(proactiveLog.userId, telegramUserId));

    // 6. Move chats and their messages
    const telegramChats = await tx
      .select({ id: chat.id })
      .from(chat)
      .where(eq(chat.userId, telegramUserId));

    if (telegramChats.length > 0) {
      await tx
        .update(chat)
        .set({ userId: webUserId })
        .where(eq(chat.userId, telegramUserId));
    }

    // 7. Set telegramId on web user
    await tx
      .update(user)
      .set({ telegramId, updatedAt: new Date() })
      .where(eq(user.id, webUserId));

    // 8. Delete orphan Telegram user record
    // (cascade should handle sessions/accounts, but be explicit)
    await tx.delete(user).where(eq(user.id, telegramUserId));
  });
}
```

- [ ] **Step 2: Check that `db` is exported from queries**

Read `src/db/queries.ts` to verify that the `db` instance is exported. If it's not exported, you'll need to export it or import it from wherever it's defined.

- [ ] **Step 3: Check schema exports**

Verify that `memory`, `scan`, `cycle`, `telegramMessage`, `proactiveLog`, `chat`, `message`, `user` are all exported from `src/db/schema.ts`. Adjust imports if needed.

- [ ] **Step 4: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 5: Commit**

```bash
git add src/lib/account/link-accounts.ts
git commit -m "feat(5B): create transactional account linking migration"
```

---

## Task 4: Create link-telegram API route

**Files:**
- Create: `src/app/(chat)/api/link-telegram/route.ts`

- [ ] **Step 1: Create the API route**

```typescript
// src/app/(chat)/api/link-telegram/route.ts

import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { createLinkCode, getLinkStatus } from "@/db/queries";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const status = await getLinkStatus({ userId: session.user.id });
  return NextResponse.json(status);
}

export async function POST() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if already linked
  const status = await getLinkStatus({ userId: session.user.id });
  if (status.linked) {
    return NextResponse.json(
      { error: "Account is already linked to Telegram" },
      { status: 400 }
    );
  }

  const linkCodeRecord = await createLinkCode({ userId: session.user.id });

  return NextResponse.json({
    code: linkCodeRecord.code,
    expiresAt: linkCodeRecord.expiresAt.toISOString(),
  });
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add src/app/(chat)/api/link-telegram/route.ts
git commit -m "feat(5B): add link-telegram API route"
```

---

## Task 5: Create link-telegram UI page

**Files:**
- Create: `src/app/(chat)/link-telegram/page.tsx`

- [ ] **Step 1: Create the page component**

```tsx
// src/app/(chat)/link-telegram/page.tsx
"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export default function LinkTelegramPage() {
  const [code, setCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [isLinked, setIsLinked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  // Check current link status on mount
  useEffect(() => {
    fetch("/api/link-telegram")
      .then((r) => r.json())
      .then((data) => {
        setIsLinked(data.linked);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Countdown timer
  useEffect(() => {
    if (!expiresAt) return;
    const interval = setInterval(() => {
      const remaining = Math.max(
        0,
        Math.floor((expiresAt.getTime() - Date.now()) / 1000)
      );
      setTimeLeft(remaining);
      if (remaining <= 0) {
        setCode(null);
        setExpiresAt(null);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const generateCode = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/link-telegram", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setCode(data.code);
        setExpiresAt(new Date(data.expiresAt));
      }
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-dvh items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (isLinked) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-4 px-4">
        <h1 className="text-2xl font-semibold">Telegram Linked</h1>
        <p className="text-center text-muted-foreground">
          Your Telegram account is already connected. Memories, scans, and chat
          history are unified across both platforms.
        </p>
        <Button onClick={() => (window.location.href = "/")} variant="outline">
          Back to Chat
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-6 px-4">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">Link your Telegram</h1>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          Connect your Telegram account so Ruhi remembers everything across both
          web and Telegram.
        </p>
      </div>

      {code ? (
        <div className="flex flex-col items-center gap-4">
          <div className="rounded-xl border border-border bg-card px-8 py-4">
            <p className="font-mono text-3xl font-bold tracking-[0.3em]">
              {code}
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            Send <code className="rounded bg-muted px-1.5 py-0.5">/link {code}</code>{" "}
            to Ruhi on Telegram
          </p>
          <p className="text-xs text-muted-foreground/60">
            Expires in {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, "0")}
          </p>
        </div>
      ) : (
        <Button disabled={generating} onClick={generateCode}>
          {generating ? "Generating..." : "Generate Link Code"}
        </Button>
      )}

      <Button
        className="mt-4"
        onClick={() => (window.location.href = "/")}
        variant="ghost"
      >
        Back to Chat
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add src/app/(chat)/link-telegram/page.tsx
git commit -m "feat(5B): add link-telegram UI page"
```

---

## Task 6: Add /link command to Telegram handler

**Files:**
- Modify: `src/lib/telegram/handler.ts`

- [ ] **Step 1: Add the /link command handler**

In the `handleCommand` function's switch statement (in `src/lib/telegram/handler.ts`), add a new case before `default`:

```typescript
case "/link": {
  const linkCodeStr = text.split(" ")[1]?.trim().toUpperCase();
  if (!linkCodeStr) {
    await tg.sendMessage(
      chatId,
      "Code bhejo! Example: /link ABC123\n\nWeb pe jaake code generate karo: ruhi-v2.vercel.app/link-telegram",
    );
    return true;
  }

  // Import link functions
  const { findValidLinkCode, markLinkCodeUsed } = await import("@/db/queries");
  const { linkAccounts } = await import("@/lib/account/link-accounts");

  const codeRecord = await findValidLinkCode({ code: linkCodeStr });
  if (!codeRecord) {
    await tg.sendMessage(
      chatId,
      "Yeh code valid nahi hai ya expire ho gaya. Web pe naya code generate karo: ruhi-v2.vercel.app/link-telegram",
    );
    return true;
  }

  // Get or create the Telegram user
  const telegramUser = await upsertTelegramUser({
    telegramId: BigInt(from.id),
    username: from.username,
  });

  // Check if Telegram user is the same as web user (linking to self)
  if (telegramUser.id === codeRecord.userId) {
    await tg.sendMessage(chatId, "Yeh account already linked hai!");
    return true;
  }

  try {
    await linkAccounts(codeRecord.userId, telegramUser.id, BigInt(from.id));
    await markLinkCodeUsed({ id: codeRecord.id });
    await tg.sendMessage(
      chatId,
      "Account linked! Ab web aur Telegram dono pe same data milega. Memories, scans, sab ek jagah!",
    );
  } catch (err) {
    console.error("[Link] Account linking failed:", err);
    await tg.sendMessage(
      chatId,
      "Sorry, linking mein kuch problem ho gayi. Thodi der mein try karo.",
    );
  }
  return true;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/telegram/handler.ts
git commit -m "feat(5B): add /link command to Telegram handler"
```

---

## Task 7: Manual smoke test

- [ ] **Step 1: Run the migration**

Ensure the `link_codes` table exists in the database:
```bash
npx drizzle-kit push
```

- [ ] **Step 2: Start dev server**

Run: `npm run dev`

- [ ] **Step 3: Test link page**

Navigate to `http://localhost:3000/link-telegram`. Verify:
- Page loads with "Link your Telegram" heading
- "Generate Link Code" button works
- 6-character code appears with countdown timer
- Instructions show `/link CODE` command

- [ ] **Step 4: Test /link command on Telegram**

Send `/link` (no code) to Ruhi on Telegram. Verify: error message asking for code.
Send `/link INVALID` to Ruhi. Verify: error message about invalid/expired code.
Send `/link ACTUAL_CODE` with the code from the web page. Verify: success message.

- [ ] **Step 5: Verify data migration**

After linking, check:
- Telegram messages still work (handler resolves to the web user ID now)
- Memories from Telegram are visible in web chat (Ruhi references them)
- The link page shows "Telegram Linked" when revisited

- [ ] **Step 6: Verify the orphan Telegram user is deleted**

Check DB: the old Telegram-only user record should be gone. Only the web user record remains, now with `telegramId` set.
