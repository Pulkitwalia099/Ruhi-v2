# Account Linking (Telegram <-> Web) — Sprint 5B Design Spec

**Date:** 2026-03-21
**Status:** Draft
**Scope:** Link Telegram and web accounts so a user's memories, scans, and chat history are unified

---

## Problem

A user who uses both Telegram and web has two separate user records:
- Telegram: `users.telegramId = 8492212211, email = tg_8492212211@telegram.local`
- Web: `users.email = priya@gmail.com`

Their memories, scans, cycle data, and chat history are split across two accounts. Ruhi on web doesn't know what Ruhi on Telegram learned, and vice versa.

## Goal

A user can link their Telegram account to their web account. After linking, all data merges into one user record, and Ruhi remembers everything across both platforms.

---

## Design Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Linking flow | Web-initiated with Telegram verification code | User logs into web (trusted), generates code, verifies on Telegram |
| Code format | 6-character alphanumeric, 10-minute expiry | Short enough to type on Telegram, long enough to be secure |
| Data migration | Move all rows from Telegram user to web user | Web user is the "primary" — they have email/password auth |
| Orphan cleanup | Delete Telegram-only user record after migration | No dangling records |
| Conflict handling | Web user data wins for identity/preference collisions | If both have "skin_type", keep the web user's value |
| Telegram command | `/link CODE` | Simple, follows existing command pattern |

---

## What Changes

### 1. Link Code Generation (Web)

**New page: `src/app/(chat)/link-telegram/page.tsx`**

Simple page with:
- "Link your Telegram account" heading
- "Generate Code" button
- Shows the 6-character code with 10-minute countdown
- Instructions: "Send `/link CODE` to Ruhi on Telegram"

**New API route: `src/app/(chat)/api/link-telegram/route.ts`**

- `POST /api/link-telegram` — generates a code, saves to DB, returns it
- `GET /api/link-telegram` — checks current link status (linked or not)

### 2. Link Code Storage

**New DB table: `link_codes`**

| Column | Type | Purpose |
|--------|------|---------|
| id | uuid | Primary key |
| userId | text (FK users) | The web user requesting the link |
| code | varchar(6) | The verification code |
| expiresAt | timestamp | 10 minutes from creation |
| usedAt | timestamp | When the code was verified (null if unused) |
| createdAt | timestamp | When created |

### 3. Telegram `/link` Command

**Modify `src/lib/telegram/handler.ts`:**

Add `/link CODE` command handler:
1. User sends `/link ABC123`
2. Look up code in `link_codes` table
3. Validate: not expired, not used
4. Run data migration (see below)
5. Mark code as used
6. Reply: "Account linked! Ab web aur Telegram dono pe same data milega."

### 4. Data Migration

**New function: `src/lib/account/link-accounts.ts`**

```
linkAccounts(webUserId: string, telegramUserId: string): Promise<void>
```

Migrates all data from the Telegram user to the web user:

1. **memories** — move all rows, skip duplicates (same category + key)
2. **scans** — move all rows (update userId)
3. **cycles** — move all rows
4. **telegram_messages** — update userId reference (keep telegramChatId)
5. **proactive_log** — move all rows
6. **chats** / **messages** — move web chat history (if any exists under Telegram user)
7. **Set telegramId** on web user record — `users.telegramId = telegramUser.telegramId`
8. **Delete orphan** Telegram user record

All in a single transaction. If any step fails, everything rolls back.

### 5. Post-Link Behavior

After linking:
- Telegram handler finds user by `telegramId` → now resolves to the web user record
- Web chat uses `session.user.id` → same user record
- Memories, scans, cycles are all unified
- Proactive messages reference the same user

---

## Files to Create/Modify

### New files
- `src/app/(chat)/link-telegram/page.tsx` — link page UI
- `src/app/(chat)/api/link-telegram/route.ts` — code generation API
- `src/lib/account/link-accounts.ts` — data migration logic
- `src/lib/db/schema.ts` — add `linkCodes` table
- Migration file — add `link_codes` table

### Modified files
- `src/lib/telegram/handler.ts` — add `/link` command
- `src/db/queries.ts` — add link code queries (create, find, mark used)

### Unchanged
- Auth system — no changes needed
- Memory system — works with new userId after migration
- Web chat route — already uses `session.user.id`

---

## Data Flow

1. **Web user** visits `/link-telegram` → clicks "Generate Code"
2. **API** creates 6-char code in `link_codes` table (10-min expiry)
3. **User** sends `/link ABC123` to Ruhi on Telegram
4. **Handler** validates code → calls `linkAccounts(webUserId, telegramUserId)`
5. **Migration** moves all data in one transaction → sets `telegramId` on web user → deletes orphan
6. **Confirmation** sent on Telegram + success shown on web page (polling or WebSocket)

---

## Scope Boundaries

**In scope (Sprint 5B):**
- Link code generation page and API
- `/link` Telegram command
- Data migration (memories, scans, cycles, messages, proactive log)
- Orphan user cleanup
- Transaction safety

**Out of scope:**
- Unlinking accounts
- Multiple Telegram accounts per web user
- Web-to-web account merging
- OAuth-based linking (Telegram Login Widget)
- Real-time sync (after linking, both platforms just use the same userId)
