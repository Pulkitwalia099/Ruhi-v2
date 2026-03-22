# Humanness Sprint — Design Spec

**Date:** 2026-03-22
**Status:** Approved
**Scope:** Message splitting, scan response pacing, emotional intelligence, response variation, rename Ruhi → Noor

---

## Problem

Noor responds instantly with wall-of-text messages. This feels robotic — real friends send multiple short messages with pauses. After scans, she jumps straight to recommendations without reacting or analyzing first. Emotional detection only works late at night (3AM mode), missing daytime distress. Over many conversations, responses fall into repetitive patterns.

## Goal

Make Noor feel like a real person texting — natural pacing, emotional awareness anytime, varied responses, and a proper React → Analyze → Advise flow for scans.

---

## Design Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Message splitting | LLM-controlled via `\|\|\|` delimiter | LLM knows natural pause points better than regex |
| Typing simulation | `sendChatAction("typing")` + delay proportional to chunk length | Simulates reading/thinking time |
| Max chunks | 3 messages per response | More feels spammy |
| Scan pacing | Immediate "thinking" message before Vision call | User doesn't stare at nothing for 5-10s |
| Good scan results | React + Analyze only (no unsolicited advice) | Friends don't prescribe when everything's fine |
| Bad scan results | React → Analyze → Advise (3 messages with splits) | Natural buildup to recommendations |
| Emotional detection | Prompt-based keyword awareness (not code-level sentiment) | LLM is already good at this, just needs explicit instructions |
| Response variation | Prompt-level variation instructions with examples | No code needed, direct impact |
| Rename | User-facing "Ruhi" → "Noor", internal code names stay | Minimal refactor, maximum impact |

---

## What Changes

### 1. Message Splitting System (Telegram)

**System prompt addition** — instruct Noor to use `|||` as a message break delimiter at natural conversational pauses:
- Short replies (1-2 sentences): no splits, single message
- Medium replies (3-4 sentences): 1 split (2 messages)
- Long replies (5+ sentences, scan analysis, routines): 2 splits (3 messages)
- Never more than 3 chunks
- `|||` is never shown to the user

**Handler change** — after getting the LLM response:
1. Split on `|||`
2. For each chunk:
   - Call `sendChatAction("typing")`
   - Wait: delay proportional to chunk length (~50ms per character, min 800ms, max 3000ms)
   - Send the message
3. Fallback: if no `|||` delimiters, send as single message (short responses stay natural)

### 2. Scan Response Pacing

**Before scan pipeline runs:**
- Send immediate "thinking" message (random from a small pool: "Hmm dekhti hoon...", "Ek second, check karti hoon...", "Photo dekh rahi hoon...")
- Then run Gemini Vision + comparison

**Scan interpretation prompt changes:**

**Good results (overall_score >= 7):**
- Pattern (b): React + Analyze only, no recommendations
- "Forehead clear, cheeks hydrated, overall 8/10 — nice! Keep going."

**Needs-attention results (overall_score < 7):**
- Pattern (a): React → Analyze → Advise with `|||` splits
- "Hmm okay...|||Cheeks pe dryness, chin pe spots. 5/10 — thoda down.|||Try salicylic acid face wash raat ko."

### 3. Emotional Intelligence (Anytime)

**System prompt addition:**
- Keyword-based emotional detection: "I hate my skin", "so ugly", "nothing works", "thak gayi", "kuch nahi hota", etc.
- Response pattern: Validate → Normalize → Minimal help
- Do NOT jump to recommendations when someone is venting
- 3AM mode stays for extra-gentle late-night behavior (zero humor, zero sass)

### 4. Response Variation

**System prompt addition:**
- Explicit variation instructions for greetings, transitions, advice framing, and acknowledgments
- Examples of alternatives for each pattern
- Permission to vary structure (problem → product vs. action-first vs. why-first)

### 5. Rename Ruhi → Noor (User-Facing)

**Files to change (user-visible text only):**
- `src/components/chat/greeting.tsx` — "Main Ruhi hoon" → "Main Noor hoon"
- `src/components/chat/preview.tsx` — same
- `src/lib/telegram/handler.ts` — `/start` message, any hardcoded "Ruhi" strings
- `src/lib/proactive/` — check message templates for "Ruhi"
- `docs/ARCHITECTURE.md` — update references

**What stays:**
- Function names (`buildRuhiSystemPrompt`, `runRuhiAgent`) — internal
- File paths (`ruhi-prompt.md`, `content/`) — rename later if needed
- Variable names — internal

---

## Files to Modify

### Modified files
- `content/ruhi-prompt.md` — add message splitting rules, emotional awareness, response variation sections
- `src/lib/telegram/handler.ts` — message splitting logic (split on `|||`, typing delays), pre-scan thinking message, rename user-facing strings
- `src/lib/ai/scan-pipeline.ts` — no changes (pipeline returns data, handler controls pacing)
- `src/components/chat/greeting.tsx` — rename
- `src/components/chat/preview.tsx` — rename
- `src/lib/proactive/` — rename in message templates
- `docs/ARCHITECTURE.md` — rename references

### Unchanged
- `src/app/(chat)/api/chat/route.ts` — web chat doesn't split messages (streaming handles pacing naturally)
- Database schema — no changes
- Memory system — no changes
- Scan comparison — no changes

---

## Scope Boundaries

**In scope:**
- `|||` delimiter message splitting for Telegram
- Typing indicators + natural delays between messages
- Pre-scan "thinking" message
- Conditional scan response pattern (good vs. needs-attention)
- Prompt-level emotional detection (anytime)
- Prompt-level response variation instructions
- Rename Ruhi → Noor (user-facing only)

**Out of scope:**
- Web chat message splitting (streaming already handles pacing)
- Code-level sentiment analysis
- Voice messages or audio
- User-configurable pacing preferences
- Renaming internal code/file paths
