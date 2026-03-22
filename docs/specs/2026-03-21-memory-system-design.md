





# Memory System Design — Ruhi v2 Sprint 2

**Date:** 2026-03-21
**Status:** Approved
**Scope:** Telegram bot only (web chat unchanged)

---

## Problem

Ruhi currently has no memory across sessions. Every conversation starts fresh — she doesn't know the user's name, skin type, products, or what they discussed last week. This makes her feel like a stranger, not a friend.

## Goal

Ruhi remembers users across sessions — their identity, skin history, products, preferences, emotional moments, and current life context. She references these memories naturally, like a real friend would.

---

## Design Decisions


| Decision                  | Choice                                           | Why                                                                             |
| ------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------- |
| How memories are created  | LLM tool-based (`saveMemory`)                    | LLM understands nuance and importance; existing tool pattern in codebase        |
| How memories are recalled | Auto-injected into system prompt                 | Reliable — no tool call needed for recall; load all, filter expired             |
| Memory categories         | 5: identity, health, preference, moment, context | Covers user picks: identity facts, skin history, preferences, proactive context |
| Vector embeddings         | Not now                                          | Simple SQL filtering sufficient at current scale (<500 memories/user)           |
| Moment summarization      | Not now                                          | Simple cap at 30, delete oldest. Summarization deferred to future sprint        |
| User-facing signals       | Subtle acknowledgment                            | Ruhi weaves it into conversation naturally, never says "Memory saved!"          |
| Missed-save fallback      | Post-hoc regex safety net                        | 3 critical identity patterns checked after each exchange, zero LLM cost         |


---

## Memory Categories

### `identity` — Core user facts

- **Behavior:** Upsert by key (new value replaces old)
- **Allowed keys:** `name`, `age`, `city`, `skin_type`, `allergies`, `conditions`, `life_stage`
- **Expiry:** Never
- **Examples:** `skin_type: "oily-combination"`, `city: "Mumbai"`, `conditions: "PCOS"`

### `health` — Skin, products, symptoms, conditions

- **Behavior:** Accumulate (entries stack over time)
- **Key:** Not used (null)
- **Optional metadata:** `status` (active/resolved/stopped), `date`
- **Expiry:** Never
- **Examples:** "Using Minimalist 10% niacinamide serum [active]", "Stopped retinol — caused peeling [stopped]"

### `preference` — How the user likes things

- **Behavior:** Upsert by key
- **Allowed keys:** `budget`, `brands`, `fragrance`, `advice_style`, `language`, `remedies`
- **Expiry:** Never
- **Examples:** `budget: "under ₹500 per product"`, `brands: "prefers Korean + Minimalist"`

### `moment` — Emotional and life events

- **Behavior:** Accumulate with cap of 30. When inserting the 31st, delete the oldest in a transaction.
- **Key:** Not used (null)
- **Expiry:** Never (oldest deleted at cap)
- **Examples:** "Stressed about new job", "Sister's wedding in April"

### `context` — Short-lived situational facts

- **Behavior:** Accumulate
- **Key:** Not used (null)
- **Expiry:** 14 days from creation (auto-expire)
- **Examples:** "Travelling to Goa this weekend", "Monsoon started in Mumbai"

---

## Data Model

### `memories` table (Drizzle ORM, Neon Postgres)

```
columns:
  id          UUID, primary key, default random
  userId      TEXT, NOT NULL, FK → users.id
  category    TEXT, NOT NULL — enum: identity | health | preference | moment | context
  key         TEXT, nullable — used by identity + preference for upsert
  value       TEXT, NOT NULL — the memory content
  metadata    JSONB, default {} — optional: { status, date }
  createdAt   TIMESTAMPTZ, default now()
  updatedAt   TIMESTAMPTZ, default now() — tracks last modification (upserts update this)
  expiresAt   TIMESTAMPTZ, nullable — set for context (now + 14 days), null for others

indexes:
  (userId, category) — primary lookup for recall
  (expiresAt) WHERE expiresAt IS NOT NULL — for cleanup cron

constraints:
  UNIQUE(userId, category, key) WHERE key IS NOT NULL — enables upsert for identity/preference
```

### Upsert logic

- `identity` + `preference`: ON CONFLICT (userId, category, key) DO UPDATE SET value, metadata, updatedAt. `createdAt` preserved as original creation date.
- `health` + `context`: Always INSERT
- `moment`: Transaction with row lock — SELECT COUNT(*) FROM memories WHERE userId=? AND category='moment' FOR UPDATE → delete oldest if ≥ 30 → insert. The FOR UPDATE lock prevents two concurrent inserts from both reading count=29 and both inserting.

---

## Tool: `saveMemory`

AI SDK tool called by Ruhi mid-conversation.

### Input schema (Zod)

```
userId:    z.string() — the user's database ID (injected via system prompt, same pattern as existing tools)
category:  z.enum(['identity', 'health', 'preference', 'moment', 'context'])
key:       z.enum([...IDENTITY_KEYS, ...PREFERENCE_KEYS]).optional()
           — REQUIRED for identity: 'name' | 'age' | 'city' | 'skin_type' | 'allergies' | 'conditions' | 'life_stage'
           — REQUIRED for preference: 'budget' | 'brands' | 'fragrance' | 'advice_style' | 'language' | 'remedies'
           — MUST be omitted for health, moment, context
           — Validated at Zod level: z.enum() prevents hallucinated keys like "zodiac_sign"
value:     z.string() — the memory content
status:    z.enum(['active', 'resolved', 'stopped']).optional() — only for health entries
date:      z.string().optional() — when user mentions a specific date
```

### Validation in execute()

- If category is 'identity' or 'preference' and key is missing → return `{ saved: false, error: "key required" }`
- If category is 'health'/'moment'/'context' and key is provided → ignore key (set to null)
- If status is provided for non-health category → ignore it

### Output

```
{ saved: true, category: string, key: string | null }
// or on failure:
{ saved: false, error: string }
```

### Error handling

If the database write fails, return `{ saved: false, error: "..." }` — **never crash the response over a memory save failure.** Ruhi continues the conversation regardless. Log the error server-side for debugging.

Ruhi does NOT surface the tool output to the user. The tool runs silently; Ruhi's natural conversational response handles any acknowledgment.

---

## Recall: Auto-Injected Memories

### Flow (runs before every LLM call)

1. **Query:** `SELECT * FROM memories WHERE userId = ? AND (expiresAt IS NULL OR expiresAt > NOW()) ORDER BY category, createdAt DESC LIMIT 200` (defense-in-depth cap — prevents runaway memory accumulation from bloating the query)
2. **Format** into a text block grouped by category (see template below)
3. **Safety cap:** If formatted text exceeds 5,000 words, truncate oldest moment and health entries from the injected text (NOT from DB)
4. **Inject** into system prompt before the tool usage section

### Injected prompt template

```markdown
## What You Remember About This User

**Identity:**
- Name: {name}
- Skin type: {skin_type}
[...dynamically built from identity memories]

**Health (recent):**
- {value} [{status}, {date}]
[...from health memories, newest first]

**Preferences:**
- {key}: {value}
[...from preference memories]

**What's happening right now:**
- {value}
[...from non-expired context memories]

**Recent moments:**
- {value}
[...from moment memories, newest first]

### How to use these memories
- Reference 1-2 memories per conversation, naturally. "Woh serum kaisa chal raha hai?" — not "On March 15 you started using a niacinamide serum."
- Health and identity references are always welcome — they make advice personal.
- Moments need gentle handling — check in ONCE, don't keep bringing it up.
- Preferences shape your response silently. If budget is "under ₹500", lead with affordable options without saying "I know you're budget-conscious."
- If no memories exist yet, that's fine. Build them as the conversation flows.
```

### Priority order in prompt

1. Identity — always (core context)
2. Health — active products + recent observations
3. Context — active situational entries
4. Moments — recent emotional/life events
5. Preferences — shape response style silently

---

## System Prompt Changes

### New tool instructions (added to Tool Usage section in prompts.ts)

```markdown
## Memory — Remembering the User

You have a saveMemory tool. Use it to remember important facts about the user across conversations.

**WHEN to save (you MUST call saveMemory):**
- User reveals their name, age, city, skin type, allergies, conditions → category: identity
- User mentions a product they're using, stopped, or started → category: health
- User mentions a skin concern, symptom, or diagnosis → category: health
- User expresses a preference (budget, brand, advice style) → category: preference
- User shares something emotional or life-related (stress, wedding, job) → category: moment
- User mentions a temporary situation (travel, weather, sleep) → category: context

**WHEN NOT to save:**
- Greetings, thank-yous, "okay", or conversational filler
- Things you already have in memory (check "What You Remember" above first)
- Ruhi's own advice or suggestions — only save USER facts

**HOW to acknowledge:**
- Never say "Memory saved!" or "I'll remember that!"
- Weave it in naturally: "Okay noted, oily skin — toh lightweight pe focus karenge"
- Or just respond normally — the save happens silently in the background

**Keys for identity:** name, age, city, skin_type, allergies, conditions, life_stage
**Keys for preference:** budget, brands, fragrance, advice_style, language, remedies
**Status for health:** active (currently using), resolved (issue fixed), stopped (discontinued)
```

### Code change in prompts.ts

`buildRuhiSystemPrompt()` gains a new optional parameter:

```
buildRuhiSystemPrompt(cycleContext?: string, memoriesBlock?: string): string
```

Insertion order in the final prompt:

1. Ruhi persona (from content/ruhi-prompt.md)
2. **Memories block** (new — injected dynamically)
3. Tool usage instructions (existing + new saveMemory instructions)
4. Cycle context (existing, if available)

### Interaction with agent.ts userId injection

In `agent.ts`, the `## Internal Context` block (containing `userId`) is appended AFTER `buildRuhiSystemPrompt()` returns. This is correct — the final prompt order is:

```
1. Ruhi persona
2. Memories block         ← new
3. Tool usage instructions (including saveMemory instructions)
4. Cycle context
5. Internal Context (userId)   ← appended by agent.ts, unchanged
```

The memories block and the Internal Context block serve different purposes — memories are Ruhi's knowledge about the user, Internal Context tells the LLM what userId to pass to tools.

### Photo/scan path also gets memories

The photo handler path in `telegram/handler.ts` also calls `buildRuhiSystemPrompt()` for the Claude interpretation step. **Memories must be injected here too** — so Ruhi can say things like "tumhari oily skin ke liye yeh findings important hai" when interpreting scan results. Same `loadMemories()` call, same `memoriesBlock` parameter.

---

## Post-Hoc Safety Net

After each successful message exchange, run a lightweight regex check for critical identity facts the LLM might have missed saving.

### Input

`runPostHocSafetyNet(userId: string, userText: string)` — `userText` is the raw text string from the Telegram message, NOT a message object.

### Patterns checked (3 only — high-value, low-cost, English + Hinglish)

```
Skin type: /(?:my skin is|skin type is|I have|meri skin|skin hai)\s+(oily|dry|combination|sensitive|normal|acne[- ]prone)/i
Name:      /(?:my name is|I'm|I am|mera naam|naam hai|main)\s+([A-Z][a-z]+)/i  (only if no 'name' memory exists)
City:      /(?:I live in|I'm from|based in|main .+ se hoon|rehti hoon|rehta hoon)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i  (only if no 'city' memory exists)
```

### Logic

For each match:

1. Check if a memory with the same (userId, category='identity', key) already exists
2. If NOT → insert it as an identity memory
3. If YES → skip (LLM already saved it)

This runs after every message, costs zero LLM tokens, and catches the 3 most important identity facts as a fallback.

---

## Expiry Cron Job

### Route: `/api/cron/cleanup-memories`

### Schedule: Daily at 3 AM UTC (`0 3 * * *`)

```
1. Verify CRON_SECRET: request.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`
   Vercel automatically sends this header for Vercel-triggered crons.
2. DELETE FROM memories WHERE expiresAt IS NOT NULL AND expiresAt < NOW()
3. Log count of deleted rows
4. Return 200
```

**Setup:** Add `CRON_SECRET` to Vercel project environment variables (Settings → Environment Variables). For local testing, add to `.env.local`. Vercel auto-generates this value when you add your first cron — or set it manually.

Note: Expired memories are already invisible in the recall query (filtered by `expiresAt > NOW()`). This cron is housekeeping only — not a reliability concern.

### vercel.json addition

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

---

## Architecture Overview

```
USER sends message on Telegram
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│  telegram/handler.ts                                     │
│                                                          │
│  1. upsertTelegramUser() → get userId                   │
│  2. getTelegramHistory() → last 20 messages              │
│  3. ★ loadMemories(userId) → formatted text block        │
│  4. buildRuhiSystemPrompt(cycleCtx, memoriesBlock)       │
│  5. runRuhiAgent(messages, { userId, systemPrompt })     │
│     └─ tools: getCycleContext, logCycle,                 │
│        getScanHistory, ★ saveMemory                      │
│  6. saveTelegramMessage() (user + assistant)              │
│  7. ★ runPostHocSafetyNet(userId, userMessage)           │
│  8. Send response via Telegram API                       │
└─────────────────────────────────────────────────────────┘

★ = new code for Sprint 2
```

---

## Files to Create / Modify

### New files

- `src/lib/ai/tools/save-memory.ts` — saveMemory tool definition
- `src/lib/memory/loader.ts` — loadMemories() + formatMemoriesBlock()
- `src/lib/memory/safety-net.ts` — post-hoc regex safety net
- `src/app/api/cron/cleanup-memories/route.ts` — expiry cron endpoint

### Modified files

- `src/db/schema.ts` — add memories table
- `src/db/queries.ts` — add memory query functions (upsert, insert, load, delete expired, count moments)
- `src/lib/ai/prompts.ts` — update buildRuhiSystemPrompt to accept memoriesBlock
- `src/lib/ai/agent.ts` — add saveMemory to tools in runRuhiAgent
- `src/lib/ai/tools/index.ts` — export saveMemory from barrel file
- `src/lib/telegram/handler.ts` — wire in loadMemories + safety net (both text AND photo paths)
- `vercel.json` — add cron schedule

### Unchanged

- `src/lib/telegram/client.ts`
- Face scan flow
- Existing tools (getCycleContext, logCycle, getScanHistory)
- Web chat route
- All existing DB tables

---

## Scope Boundaries

**In scope (Sprint 2):**

- memories table + Drizzle schema
- saveMemory tool with enum keys
- Auto-injected recall with safety cap
- Post-hoc regex safety net (3 patterns)
- Context expiry cron
- Moment cap at 30 (delete oldest)
- System prompt updates

**Explicitly out of scope:**

- Vector embeddings / semantic search
- Moment summarization / archiving
- Web chat memory integration
- Memory editing/deletion by user
- Memory analytics or dashboards
- Distress/safety flagging (separate sprint)

---

## Migration

One Drizzle migration required:

- Create `memories` table with columns, indexes, and partial unique constraint
- Run via `npx drizzle-kit generate` → `npx drizzle-kit push`
- No changes to existing tables

