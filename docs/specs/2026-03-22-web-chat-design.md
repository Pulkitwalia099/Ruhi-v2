# Web Chat + Auth — Sprint 4E Design Spec

**Date:** 2026-03-22
**Status:** Implemented
**Scope:** Web chat with Ruhi persona, memory, and tools (text only, no photo upload)

---

## Problem

Ruhi only works on Telegram. Users who prefer browser or don't use Telegram can't access her. The web chat UI exists (from the digimata fork) but is a generic chatbot — no Ruhi persona, no memory, no skincare tools.

## Goal

Users can chat with Ruhi at ruhi-v2.vercel.app with the same persona, memory, and tools as Telegram. Text-only for this sprint (photo upload deferred to Sprint 5A).

---

## Design Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Strip artifacts | Yes — remove document/code/sheet tools | Ruhi is a skincare companion, not a document editor. Reduces complexity and UI clutter |
| Photo upload | Deferred to Sprint 5A | Requires camera/gallery UI, file upload handling. Separate scope |
| Account linking | Deferred to Sprint 5B | Requires Telegram ↔ Web identity merge. Plan now, execute later |
| Auth method | Keep BetterAuth (email/password + anonymous guest) | Already works, no changes needed |
| Streaming | Keep AI SDK useChat streaming | Already works for web chat |

---

## What Changes

### 1. Strip Artifact System

**Remove from web chat agent tools:**
- `createDocument`
- `updateDocument`
- `editDocument`
- `requestSuggestions`

**Keep the files** (don't delete) — just remove from the tool list passed to `createChatAgent()`. This way we can re-enable if needed.

**UI changes:**
- Hide artifact panel / document editor in the chat UI
- Remove artifact-related buttons from the toolbar
- Keep the chat shell, sidebar, message list

### 2. Connect Ruhi to Web Chat

**`src/app/(chat)/api/chat/route.ts`** — the main web chat route:

Currently:
```
createChatAgent({ model, tools: { createDocument, updateDocument, ... } })
```

Change to:
```
createChatAgent({ model, tools: { getCycleContext, logCycle, getScanHistory, saveMemory } })
```

**System prompt:** Currently uses generic `systemPrompt()` with geo hints. Change to use `buildRuhiSystemPrompt()` with:
- Memory injection (loadAndFormatMemories)
- userId injection for tools
- Cycle context if available

**Post-response:** Run safety net on web messages too.

### 3. Web Chat Route Changes

**File:** `src/app/(chat)/api/chat/route.ts`

Current flow:
1. Auth check (getSession)
2. Get model from request
3. Build generic system prompt
4. Create chat agent with artifact tools
5. Stream response

New flow:
1. Auth check (getSession)
2. Load user memories
3. Build Ruhi system prompt (with memories)
4. Create chat agent with Ruhi tools (cycle, scan, memory)
5. Inject userId into system prompt
6. Stream response
7. Post-response: run safety net

### 4. UI Simplification

**Hide artifact-related UI elements:**
- Document editor panel
- "Create document" buttons
- Sheet/code/image artifact types
- Suggestion panel

**Keep:**
- Chat message list
- Prompt input
- Sidebar with chat history
- Model selector (optional — could hardcode to Haiku)

---

## Files to Modify

### Modified files
- `src/app/(chat)/api/chat/route.ts` — swap tools, add memory, use Ruhi prompt
- `src/app/(chat)/api/chat/[id]/stream/route.ts` — same changes for stream resumption
- `src/components/chat/chat-shell.tsx` — hide artifact panel
- `src/components/chat/toolbar.tsx` — remove artifact buttons

### Files to review (may need changes)
- `src/components/chat/messages.tsx` — ensure tool call rendering handles Ruhi's tools
- `src/hooks/use-chat.ts` — may need adjustment if artifact hooks are interleaved

### Unchanged
- Auth system (BetterAuth) — works as-is
- Database tables — web uses same `chats`, `messages`, `memories` tables
- Telegram handler — completely separate path
- Memory system — shared, no changes
- Scan comparison — not used in web (no photo upload yet)

---

## Account Linking Plan (Sprint 5B — plan now, execute later)

### Problem
A user might use both Telegram and web. Currently they'd have two separate user records:
- Telegram: `users.telegramId = 8492212211, email = tg_8492212211@telegram.local`
- Web: `users.email = priya@gmail.com`

Their memories, scans, and chat history would be split.

### Solution (to implement in Sprint 5B)
1. Add a `/link-telegram` page in the web UI
2. User logs in on web, clicks "Link Telegram"
3. Generate a one-time code, show to user
4. User sends code to Ruhi on Telegram (`/link CODE`)
5. Backend merges: set `telegramId` on the web user record, migrate memories from the Telegram-created user to the web user, delete the orphan Telegram user record

### Data migration during linking
- Move all `memories` rows from old userId to new userId
- Move all `scans` rows
- Move all `telegram_messages` (update telegramChatId stays same, just userId reference changes)
- Move all `proactive_log` rows
- Delete orphan user record

### Why plan now
The web chat userId and Telegram userId need to be distinct paths that CAN be merged later. Current design supports this — both create entries in the same `users` table, and all feature tables FK to `users.id`. The merge is a data migration, not a schema change.

---

## Scope Boundaries

**In scope (Sprint 4E):**
- Strip artifact tools from web chat agent
- Connect Ruhi persona, memory, and tools to web chat
- Safety net on web messages
- Hide artifact UI elements
- Web chat works with existing BetterAuth (email/password + anonymous)

**Explicitly out of scope:**
- Photo upload from browser (Sprint 5A)
- Account linking Telegram ↔ Web (Sprint 5B)
- Removing artifact source files (keep for potential future use)
- Mobile-optimized web UI
- Push notifications from web
