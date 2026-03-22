# Proactive Ruhi — Sprint 3B Design Spec

**Date:** 2026-03-22
**Status:** Draft
**Scope:** Telegram bot only

---

## Problem

Ruhi only responds — she never initiates. This makes her feel like a tool, not a friend. Real friends check in: "woh serum kaisa chal raha hai?", "scan kar, compare karte hain", "aaj dhoop bohot hai, sunscreen laga lena."

## Goal

Ruhi sends proactive messages that feel natural and earned — never spammy. Every proactive message has a clear reason the user can understand.

---

## Three Proactive Message Types

### 1. Product Follow-Up

**Trigger:** Ruhi recommended a product/ingredient/routine change in a conversation.

**Schedule:**
- **Day 3:** First check-in — "Woh [product] try kiya? Kaisa lag raha hai?"
- **Day 5:** Second check-in (only if user didn't respond to day 3) — "Bas check kar rahi thi — [product] se koi reaction toh nahi aaya?"
- After day 5: stop. Don't nag.

**What to track:**
- When Ruhi recommends something, save it as a new memory type
- Category: `health`, metadata: `{ type: "recommendation", product: "...", recommendedAt: "2026-03-22", followUpsDone: 0 }`
- The `followUpsDone` counter tracks how many nudges have been sent (0 → 1 → 2, then stop)

**How Ruhi saves recommendations:**
- Update the saveMemory tool instructions to include: "When you recommend a product, ingredient, or routine change, save it as a health memory with status 'recommended'"
- Add `"recommended"` to the health status enum (alongside active, resolved, stopped)
- The `date` field captures when the recommendation was made

### 2. Scan Comparison Nudge

**Trigger:** User's last scan was N days ago.

**Schedule:**
- **Day 4:** First nudge — "Pichli baar [top concern] tha — ek fresh scan bhej, compare karte hain"
- **Day 10:** Second nudge (only if no new scan since first nudge) — "10 din ho gaye last scan ke — ek quick selfie bhej, dekhte hain progress"
- After day 10: stop.

**What to track:**
- Query `scans` table for user's last scan date
- Track nudges sent via a `proactive_log` table (prevents duplicate nudges)

### 3. Weather-Based Skincare Tips

**Trigger:** Significant weather change in the user's city that affects skincare.

**Schedule:** Evaluated daily at ~9 AM IST. Only sends if there's a genuinely helpful tip.

**What counts as "significant":**
- Humidity spike/drop (>20% change from 3-day average)
- UV index very high (≥8)
- Temperature extreme (>40°C or <10°C)
- Sudden rain/monsoon onset after dry spell
- Air quality index (AQI) very poor (≥300)

**Logic:**
1. Fetch current weather + 3-day history for user's city (from identity memory)
2. Compare today vs 3-day average
3. If any threshold breached → generate a tip
4. If nothing notable → skip (no message)

**Examples:**
- Humidity 85% (avg was 60%): "Mumbai mein humidity badh gayi — gel moisturizer switch kar, cream heavy lagegi aaj"
- UV 9: "UV bohot high hai aaj — sunscreen reapply kar 2-3 ghante mein, especially agar bahar ja rahi ho"
- AQI 350: "Air quality bahut kharab hai — double cleanse tonight, pollution skin pe baithti hai"

**Weather API:** Open-Meteo (free, no API key needed) — same one already used by the getWeather tool in the web chat.

---

## Global Rules

### Frequency Cap
- **If user inactive 48+ hours:** Maximum 1 proactive message per 24 hours (don't overwhelm them back)
- **If user active (chatted in last 48h):** Can send multiple proactive messages per day (they're engaged, conversation feels natural)
- Priority order when multiple are due: product follow-up > scan nudge > weather tip
- Priority reasoning: product follow-up is time-sensitive (3/5 day window), scan nudge is flexible, weather is informational

### Quiet Hours
- Only send between **9 AM - 9 PM IST** (3:30 AM - 3:30 PM UTC)
- If a message is due outside quiet hours, defer to next 9 AM

### Inactivity Definition
- "Inactive" = no messages sent by user in `telegram_messages` table in last 48h
- "Active" = at least one message from user in last 48h

### Opt-Out
- `/quiet` command — pauses all proactive messages
- `/nudge` command — resumes proactive messages
- **Natural language opt-out:** If user says things like "stop messaging me", "mat bhej", "don't send", "band kar", detect and pause automatically
- Store preference in user table or as a preference memory: `key: "proactive", value: "paused"/"active"`

### Message Style
- **LLM-generated** using the user's memories for personalization
- System prompt includes: the proactive reason (what to follow up on), user's memories, and instructions to be brief and casual
- Messages should feel like Ruhi is texting, not like a notification:
  - ✅ "Arre woh CeraVe PM moisturizer kaisa chal raha hai? Suit kar raha hai na?"
  - ❌ "Reminder: You started using CeraVe PM Moisturizer 5 days ago. How is it working?"

---

## Data Model

### New table: `proactive_log`

```
columns:
  id          UUID, primary key, default random
  userId      TEXT, NOT NULL, FK → users.id
  type        TEXT, NOT NULL — enum: product_followup | scan_nudge | weather_tip
  referenceId TEXT, nullable — memory ID (for product) or scan ID (for scan nudge)
  sentAt      TIMESTAMPTZ, NOT NULL, default now()
  message     TEXT, NOT NULL — the message that was sent

indexes:
  (userId, type, referenceId) — lookup for "did we already nudge about this?"
  (userId, sentAt) — for frequency cap check
```

### Schema changes

**`memories` table:** No schema change needed. Product recommendations use existing columns:
- category: "health"
- metadata: `{ status: "recommended", product: "niacinamide serum", recommendedAt: "2026-03-22" }`

**`users` table:** Add `proactiveEnabled` boolean, default true. Toggled by `/quiet` and `/nudge`.

OR: Store as preference memory (`key: "proactive"`, `value: "active"/"paused"`). Simpler — no migration needed.

**Decision:** Use preference memory. No schema migration for users table.

### saveMemory tool update

Add `"recommended"` to the status enum:
```
status: z.enum(["active", "resolved", "stopped", "recommended"]).optional()
```

Update prompt instructions to tell Ruhi when to use it.

---

## Architecture

### Cron Job: `/api/cron/proactive-ruhi`

**Schedule:** Every hour (`0 * * * *`)
- Runs hourly but only sends during quiet hours (9 AM - 9 PM IST)
- Hourly granularity ensures messages go out close to when they're due

**Flow:**

```
1. Verify CRON_SECRET
2. Get current hour in IST — if outside 9 AM - 9 PM, return early
3. Fetch all users with proactive enabled (no "proactive: paused" preference memory)
4. For each user:
   a. Check activity: any telegram_message from user in last 48h?
      - If INACTIVE (no messages in 48h): max 1 message → check frequency cap (any proactive_log in last 24h? → skip)
      - If ACTIVE: no frequency cap, can send all due messages
   b. Check for due product follow-ups (priority 1) → generate + send + log
   c. Check for due scan nudges (priority 2) → generate + send + log
   d. Check for weather tips (priority 3) → generate + send + log
   e. If inactive, stop after first message sent
```

### Product Follow-Up Check

```
1. Query memories: category='health', metadata->>'status'='recommended'
2. For each recommendation:
   a. Calculate days since recommendedAt
   b. Check proactive_log: how many product_followup entries for this memory ID?
   c. If days >= 3 AND followups = 0 → due for first follow-up
   d. If days >= 5 AND followups = 1 → due for second follow-up
   e. If followups >= 2 → done, skip
```

### Scan Nudge Check

```
1. Query scans: get latest scan for user, ordered by createdAt DESC
2. If no scans → skip (never scanned, don't nudge)
3. Calculate days since last scan
4. Check proactive_log: scan_nudge entries since last scan date
5. If days >= 4 AND nudges = 0 → first nudge
6. If days >= 10 AND nudges = 1 → second nudge
7. If nudges >= 2 → done
```

### Weather Check

```
1. Get user's city from identity memory
2. If no city → skip
3. Fetch current weather from Open-Meteo API
4. Fetch 3-day history from Open-Meteo API
5. Compare: humidity delta, UV index, temperature, AQI
6. If any threshold breached → generate weather tip
7. If nothing notable → skip
```

### LLM Message Generation

For each proactive message, call Claude with:

```
System prompt:
- Ruhi persona (from ruhi-prompt.md)
- User's memories block
- "You are sending a proactive check-in message. Keep it to 1-2 sentences. Be casual and warm."

User message (constructed by cron):
- Product: "Follow up on your recommendation of [product] from [N] days ago. Ask if they tried it and how it's going."
- Scan: "User's last scan was [N] days ago. Key concerns were: [concerns]. Nudge them to send a new selfie for comparison."
- Weather: "Weather in [city]: [conditions]. Previous 3 days: [history]. Give a brief skincare tip for this change."
```

---

## Files to Create / Modify

### New files
- `src/lib/proactive/checker.ts` — main orchestrator (checks all three types per user)
- `src/lib/proactive/product-followup.ts` — product recommendation follow-up logic
- `src/lib/proactive/scan-nudge.ts` — scan comparison nudge logic
- `src/lib/proactive/weather-tip.ts` — weather-based skincare tip logic
- `src/lib/proactive/sender.ts` — LLM message generation + Telegram send + logging
- `src/app/api/cron/proactive-ruhi/route.ts` — hourly cron endpoint

### Modified files
- `src/db/schema.ts` — add `proactive_log` table
- `src/db/queries.ts` — add proactive log queries (insert, check frequency, check nudge count)
- `src/lib/ai/tools/save-memory.ts` — add "recommended" to status enum
- `src/lib/ai/prompts.ts` — add recommendation save instructions
- `src/lib/telegram/handler.ts` — handle `/quiet` and `/nudge` commands, natural language opt-out detection
- `vercel.json` — add hourly cron schedule

### Unchanged
- Memory system (Sprint 2) — used as-is for recall and recommendation storage
- Face scan flow — unchanged
- Web chat — unchanged

---

## Scope Boundaries

**In scope (Sprint 3B):**
- proactive_log table + Drizzle schema
- Product follow-up (day 3 + day 5)
- Scan nudge (day 4 + day 10)
- Weather tips (daily evaluation, send only if notable)
- LLM-generated messages using memories
- Frequency cap (1/day), quiet hours (9 AM - 9 PM IST), inactivity check (48h)
- /quiet, /nudge commands + natural language opt-out
- Hourly cron job

**Explicitly out of scope:**
- Cycle phase reminders (future sprint)
- Morning/evening routine nudges (future sprint)
- Multi-channel (web push, email) — Telegram only
- Analytics/dashboards for proactive message engagement
- A/B testing message variations
- User timezone detection (assume IST for now)

---

## Open Questions

1. **Weather API rate limits:** Open-Meteo is free but has rate limits. With many users, we may need caching (one fetch per city per day, not per user).
2. **Cost:** LLM-generated proactive messages cost ~$0.001-0.003 each (Haiku). At scale (1000 users × 1 msg/day) = ~$1-3/day. Acceptable?
3. **Recommendation detection:** The LLM needs to reliably call saveMemory with status "recommended" when it suggests a product. May need prompt engineering or a post-hoc check similar to the safety net.
