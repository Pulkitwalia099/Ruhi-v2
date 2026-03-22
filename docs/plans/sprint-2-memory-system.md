# Sprint 2 Implementation Plan — Memory System

**Spec:** `docs/specs/2026-03-21-memory-system-design.md`
**Date:** 2026-03-21
**Estimated steps:** 7 phases, 11 files (4 new, 7 modified)

---

## Phase 1: Database Schema + Migration

**Goal:** Create the `memories` table in Drizzle and push to Neon.

### Step 1.1 — Add memories table to schema

**File:** `src/db/schema.ts` (modify)

Add after the existing `telegramUser` table:

```ts
export const memory = pgTable(
  "memory",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    category: text("category", {
      enum: ["identity", "health", "preference", "moment", "context"],
    }).notNull(),
    key: text("key"),
    value: text("value").notNull(),
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
    expiresAt: timestamp("expiresAt"),
  },
  (table) => [
    index("memory_user_category_idx").on(table.userId, table.category),
    index("memory_expires_idx")
      .on(table.expiresAt)
      .where(sql`${table.expiresAt} IS NOT NULL`),
    unique("memory_user_category_key_unique")
      .on(table.userId, table.category, table.key)
      .where(sql`${table.key} IS NOT NULL`),
  ]
);
```

**Why this structure:**
- `category` uses Drizzle's text enum (matches spec's 5 categories)
- `key` is nullable — only used by identity/preference for upsert
- Partial unique constraint enables ON CONFLICT upsert for identity/preference while allowing duplicate (userId, category, null) rows for health/moment/context
- `onDelete: cascade` ties memories to user lifecycle

### Step 1.2 — Generate and push migration

```bash
npx drizzle-kit generate
npx drizzle-kit push
```

**Verify:** Check Neon dashboard or `npx drizzle-kit studio` to confirm table + indexes exist.

---

## Phase 2: Database Query Functions

**Goal:** Add all memory CRUD operations to the query layer.

**File:** `src/db/queries.ts` (modify)

### Step 2.1 — Add imports

Add `memory` to the schema import. Add `sql` from `drizzle-orm` if not already imported.

### Step 2.2 — Add these functions

**`upsertMemory()`** — For identity + preference (ON CONFLICT upsert)

```ts
async function upsertMemory({
  userId, category, key, value, metadata
}: {
  userId: string;
  category: "identity" | "preference";
  key: string;
  value: string;
  metadata?: Record<string, unknown>;
})
```

Uses `db.insert(memory).values(...).onConflictDoUpdate()` targeting the partial unique constraint. Updates `value`, `metadata`, `updatedAt`. Preserves original `createdAt`.

**`insertMemory()`** — For health + context (always insert)

```ts
async function insertMemory({
  userId, category, value, metadata, expiresAt
}: {
  userId: string;
  category: "health" | "context";
  value: string;
  metadata?: Record<string, unknown>;
  expiresAt?: Date;
})
```

For `context` category: `expiresAt` = `new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)`.

**`insertMomentMemory()`** — For moment (capped at 30, transactional)

```ts
async function insertMomentMemory({
  userId, value, metadata
}: {
  userId: string;
  value: string;
  metadata?: Record<string, unknown>;
})
```

Uses `db.transaction()`:
1. `SELECT COUNT(*) FROM memory WHERE userId=? AND category='moment' FOR UPDATE`
2. If count >= 30: `DELETE` the oldest by `createdAt ASC LIMIT 1`
3. `INSERT` the new moment

The `FOR UPDATE` lock prevents the race condition described in the spec.

**`loadMemories()`** — For recall (injected into system prompt)

```ts
async function loadMemories(userId: string): Promise<Array<{
  category: string; key: string | null; value: string;
  metadata: Record<string, unknown>; createdAt: Date;
}>>
```

Query: `SELECT * FROM memory WHERE userId = ? AND (expiresAt IS NULL OR expiresAt > NOW()) ORDER BY category, createdAt DESC LIMIT 200`

**`deleteExpiredMemories()`** — For cron job

```ts
async function deleteExpiredMemories(): Promise<number>
```

`DELETE FROM memory WHERE expiresAt IS NOT NULL AND expiresAt < NOW()` — returns count of deleted rows.

**`findMemoryByKey()`** — For safety net (check if memory exists)

```ts
async function findMemoryByKey(
  userId: string, category: string, key: string
): Promise<{ id: string; value: string } | null>
```

---

## Phase 3: Memory Loader + Formatter

**Goal:** Load memories from DB, format into the text block that gets injected into system prompt.

**File:** `src/lib/memory/loader.ts` (new)

### Step 3.1 — `loadAndFormatMemories(userId: string): Promise<string | null>`

1. Call `loadMemories(userId)` from queries
2. If no memories returned, return `null` (no block injected)
3. Group by category
4. Format using the template from the spec (Identity, Health, Preferences, Context, Moments)
5. **Safety cap:** If formatted text exceeds 5,000 words, truncate oldest moment/health entries from the *formatted text* (not DB)
6. Return the full markdown block including the "How to use these memories" instructions

**Why a separate file:** Keeps formatting logic isolated from DB queries. The loader is the bridge between raw DB rows and the prompt-ready text block.

---

## Phase 4: saveMemory Tool

**Goal:** Create the AI SDK tool that Ruhi calls mid-conversation to persist memories.

**File:** `src/lib/ai/tools/save-memory.ts` (new)

### Step 4.1 — Tool definition

Follow the existing tool pattern (see `get-cycle-context.ts`):

```ts
export const saveMemory = tool({
  description: "Save important facts about the user to memory...",
  parameters: z.object({
    userId: z.string(),
    category: z.enum(["identity", "health", "preference", "moment", "context"]),
    key: z.enum([
      "name", "age", "city", "skin_type", "allergies", "conditions", "life_stage",
      "budget", "brands", "fragrance", "advice_style", "language", "remedies",
    ]).optional(),
    value: z.string(),
    status: z.enum(["active", "resolved", "stopped"]).optional(),
    date: z.string().optional(),
  }),
  execute: async ({ userId, category, key, value, status, date }) => {
    // Validation + routing to correct query function
  },
});
```

### Step 4.2 — Execute logic

1. **Validate:** If identity/preference and no key → return `{ saved: false, error: "key required" }`
2. **Sanitize:** If health/moment/context and key provided → set key to null. If status on non-health → ignore.
3. **Route:**
   - identity/preference → `upsertMemory()`
   - health → `insertMemory()` with metadata `{ status, date }`
   - context → `insertMemory()` with auto-calculated `expiresAt` (14 days)
   - moment → `insertMomentMemory()`
4. **Return:** `{ saved: true, category, key }` on success
5. **Error handling:** Wrap in try/catch, return `{ saved: false, error: message }` — never throw. Log server-side.

### Step 4.3 — Export from barrel

**File:** `src/lib/ai/tools/index.ts` (modify)

Add: `export { saveMemory } from './save-memory';`

---

## Phase 5: Post-Hoc Safety Net

**Goal:** Regex fallback that catches critical identity facts the LLM might miss.

**File:** `src/lib/memory/safety-net.ts` (new)

### Step 5.1 — `runPostHocSafetyNet(userId: string, userText: string): Promise<void>`

Three regex patterns (from spec):

| Pattern | Category | Key |
|---------|----------|-----|
| Skin type (oily/dry/combination/sensitive/normal/acne-prone) | identity | skin_type |
| Name (English + Hinglish patterns) | identity | name |
| City (English + Hinglish patterns) | identity | city |

Logic per match:
1. Check if memory with (userId, 'identity', key) already exists via `findMemoryByKey()`
2. If not → `upsertMemory()` to save it
3. If yes → skip (LLM or a previous safety net run already saved it)

**Important:** This runs *after* the response is sent, so it never blocks the user. Wrap everything in try/catch — a safety net failure must never affect the conversation.

---

## Phase 6: Wire Everything Together

**Goal:** Connect all new pieces into the existing handler and agent.

### Step 6.1 — Update system prompt builder

**File:** `src/lib/ai/prompts.ts` (modify)

- Add `memoriesBlock?: string` parameter to `buildRuhiSystemPrompt()`
- Insert memories block after persona, before tool instructions
- Add the new "Memory — Remembering the User" tool instructions to the tool usage section (from spec)

### Step 6.2 — Add saveMemory to agent tools

**File:** `src/lib/ai/agent.ts` (modify)

- Import `saveMemory` from tools
- Add to the tools object in `runRuhiAgent()`: `saveMemory`
- No changes to `createChatAgent()` (web chat is out of scope)

### Step 6.3 — Wire into Telegram handler

**File:** `src/lib/telegram/handler.ts` (modify)

In the **text message** path:
1. After `upsertTelegramUser()` and before `runRuhiAgent()`:
   - Call `loadAndFormatMemories(userId)`
   - Pass result to `buildRuhiSystemPrompt(cycleContext, memoriesBlock)`
2. After saving the assistant message:
   - Call `runPostHocSafetyNet(userId, userMessageText)`

In the **photo** path:
1. Same memory loading before the LLM interpretation call
   - The photo handler also calls `buildRuhiSystemPrompt()` — pass `memoriesBlock` here too

---

## Phase 7: Expiry Cron Job

**Goal:** Daily cleanup of expired context memories.

**File:** `src/app/api/cron/cleanup-memories/route.ts` (new)

```ts
export async function GET(request: Request) {
  // 1. Verify CRON_SECRET
  // 2. Call deleteExpiredMemories()
  // 3. Log count, return 200
}
```

**File:** `vercel.json` (modify)

```json
{
  "crons": [
    {
      "path": "/api/cron/cleanup-memories",
      "schedule": "0 3 * * *"
    }
  ]
}
```

**Setup:** Add `CRON_SECRET` to Vercel environment variables.

---

## Implementation Order (dependency graph)

```
Phase 1 (schema + migration)
    ↓
Phase 2 (query functions)
    ↓
Phase 3 (loader) ←── depends on queries
Phase 4 (saveMemory tool) ←── depends on queries
Phase 5 (safety net) ←── depends on queries
    ↓
Phase 6 (wiring) ←── depends on all above
    ↓
Phase 7 (cron) ←── independent, can be done anytime after Phase 2
```

**Phases 3, 4, 5 can be done in parallel** — they all depend on Phase 2 but not on each other.

---

## Testing Checklist

After each phase, verify:

- [ ] **Phase 1:** Migration runs clean, table visible in Drizzle Studio
- [ ] **Phase 2:** Write a quick test script that inserts/upserts/loads memories
- [ ] **Phase 3:** `loadAndFormatMemories()` returns null for new user, formatted block for user with memories
- [ ] **Phase 4:** In a test conversation, tell Ruhi "my name is Priya" → check DB for identity/name memory
- [ ] **Phase 5:** Send "I live in Mumbai" without LLM saving it → safety net catches it
- [ ] **Phase 6:** Full flow — send messages on Telegram, verify memories appear in next conversation's system prompt
- [ ] **Phase 7:** Insert a context memory with past expiresAt → run cron → verify it's deleted

---

## Risk Notes

1. **Partial unique constraint syntax in Drizzle:** Drizzle's `.where()` on unique constraints is relatively new — verify the generated SQL is correct before pushing.
2. **FOR UPDATE in moment cap:** Neon supports row-level locks, but verify in Neon's serverless driver (`@neondatabase/serverless`) — some serverless Postgres drivers have transaction quirks.
3. **System prompt size:** With 200 memories loaded, the prompt could get large. The 5,000-word safety cap in the loader handles this, but monitor token usage after launch.
4. **Photo path:** The spec calls out that photo interpretation also needs memories. Don't forget this path — it's easy to miss since it's a separate code branch in handler.ts.
