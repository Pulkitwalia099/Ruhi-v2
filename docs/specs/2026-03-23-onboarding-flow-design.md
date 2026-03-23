# Onboarding Flow Design — Noor (Telegram)

**Date:** 2026-03-23
**Status:** Draft
**Channel:** Telegram (migrates to Instagram DM later)

---

## Overview

When a new user starts Noor on Telegram, they go through a guided onboarding that feels like meeting a friend — not filling out a form. Noor collects key skin info via tap-based questions, asks for a selfie, runs a skin analysis, and delivers a personalized Skin Profile Card as the "wow" moment. Text-based insights follow the card, and Noor offers to help with their primary concern — starting the ongoing relationship.

### Goals

1. **Eliminate cold start** — Noor knows the user before the first real conversation
2. **Quick gratification** — user gets a personalized, shareable Skin Profile Card within ~2 minutes
3. **Start the relationship** — Noor transitions from analysis into "let's work on this together"

### Non-Goals

- Collecting every possible data point upfront (city, period cycle, budget come later)
- Replacing the existing full Skin Report Card (that remains a separate, deeper analysis)
- Web onboarding (Telegram-first for now)

---

## User Flow

### Step 1 — Hello + Intent (tap)

> "Heyy! 💕 Main Noor hoon — tumhari skincare bestie.
>
> Batao, what's on your mind?"

- ✨ Personalized skin analysis
- 😤 Kuch skin issue bother kar raha hai
- 💬 Bas baat karni hai

**Routing:**
- "Skin analysis" → Step 2
- "Skin issue" → Step 2, but Noor frames it as: "Okay let's start with a quick skin analysis — tumhe better samajh paungi and help bhi better kar paungi"
- "Bas baat karni hai" → open chat, onboarding state = `skipped`, Noor can offer analysis naturally later

### Step 2 — Let's Go

> "Nice! Tumhe better samajhne ke liye kuch quick cheezein pooch lungi — taaki jo bataun wo actually kaam aaye. Chalo?"

- Chalo! 🙌

### Step 3 — Name (text input)

> "What should I call you?"

### Step 4 — Skin Type (tap)

> "Tumhara skin type kya lagta hai?"

- 🌊 Oily
- 🏜️ Dry
- 🎭 Combination
- 🌹 Sensitive
- 🤷‍♀️ Pata nahi

### Step 5 — Current Routine (tap)

> "Abhi kya routine chal rahi hai?"

- 🧴 Basics — cleanser, moisturizer, sunscreen
- ✨ Thoda serious — basics + serums/actives
- 💅 Full set hai mera
- 🤷‍♀️ Kuch khaas nahi

### Step 6 — Main Concern (tap, pick one)

> "Skin mein sabse zyada kya bother karta hai?"

- 😤 Acne / breakouts
- 🌑 Pigmentation / dark spots
- 😶‍🌫️ Dull skin / no glow
- 👀 Dark circles
- ✨ Bas overall improve karna hai

### Step 7 — Allergies (tap, multi-select)

> "Koi allergy ya sensitivity?"

- ✅ Nope, all good
- 🌸 Fragrance is an issue
- 🧪 Kuch specific ingredients se
- 💍 Metals se (jewellery etc.)
- 🤔 Sure nahi hoon

### Step 8 — Acknowledge + Selfie Ask

> "[Name], I like how aware you are already! 💕
>
> Ab ek selfie bhejo — no filter, close-up, natural light mein 📸
> Main properly dekh ke bataungi kya ho raha hai and kya actually kaam karega."

### Step 9 — Selfie Received → Scan Pipeline

Run existing scan pipeline (Gemini Vision) on the selfie. While processing, Noor can send a "Dekh rahi hoon... 👀" message for feedback.

### Step 10 — Text Analysis (Noor AI)

Noor generates a warm, conversational read based on the selfie scan results + onboarding answers. This is AI-generated, not templated.

Example tone:
> "Okay [Name], dekha maine! Your T-zone is working overtime and those marks on your cheeks? That's your skin holding onto past breakouts. But your overall texture is actually really good — strong base hai tumhari. Let me make something for you..."

### Step 11 — Skin Profile Card

Send the card image via `tg.sendPhoto()`.

Then follow up:
> "Ye tumhari Skin Profile hai 💕 Save karlo!
>
> [Name], [concern] ke liye mere paas kuch ideas hain. Want to get into it? 🙌"

User says yes → normal Noor chat begins, fully contextualized.

---

## Skin Profile Card Design

### Approach

Variant of the existing Skin Report Card (`src/lib/report/skin-report.tsx`). Reuses ~90% of the existing JSX, palette, and infrastructure. Key differences:

| Element | Report Card | Profile Card |
|---|---|---|
| Title | "Skin Report Card" | "[Name]'s Skin Profile" |
| Verdict badge | Generic labels | Personality labels (see below) |
| CTA | "Get your free report on meetSakhi.com" | "Get yours → meetSakhi.com ✨" |
| Everything else | Same | Same |

### Dimensions & Palette

- 1080x1350px (Instagram 4:5, shareable)
- Existing Sakhiyaan warm palette (cream bg, teal/coral/amber scoring)

### Personality Labels

The verdict badge uses curated personality labels instead of the generic pool. Selected based on (concern + skin type + score):

| Score + Vibe | Labels |
|---|---|
| 8+ any | "Naturally Blessed", "Effortless Glow" |
| 7+ glow-seeking | "Main Character Skin 💅", "Born to Glow" |
| 5+ acne fighting | "Clear Skin Era ✨", "On My Way to Flawless" |
| 5+ minimalist routine | "Skinimalist", "Effortless Beauty" |
| 5+ sensitive skin | "Soft Girl Skin 🌸", "Gentle Glow" |
| Any, just starting | "Day One Energy 🚀", "Fresh Start, Fresh Face" |

### Why It's Shareable

- Big score circle creates curiosity ("what's MY score?")
- Personality label is fun and identity-driven
- Metrics with emoji bars are visually striking
- CTA invites friends to get their own

---

## Technical Architecture

### Onboarding State Machine

```
START → awaiting_intent ─┬→ awaiting_name → awaiting_skin_type
                         │  → awaiting_routine → awaiting_concern
                         │  → awaiting_allergies → awaiting_selfie
                         │  → generating_profile → COMPLETE
                         │
                         └→ skipped (user picked "Bas baat karni hai")
                              └→ can transition to awaiting_name later
                                 when user asks for skin analysis
```

State persists in the database so users can resume if they leave mid-flow. Users in `skipped` state transition back into the flow when they request a skin analysis — Noor picks up at `awaiting_name` (or later, if memories already exist via smart skip).

### Database Schema

Dedicated `onboardings` table (not columns on `user`, to keep concerns separated):

```ts
export const onboarding = pgTable("onboardings", {
  userId: text("userId").primaryKey().references(() => user.id, { onDelete: "cascade" }),
  state: text("state").notNull().default("awaiting_intent"),
  answers: jsonb("answers").notNull().default({}), // partial answers stored as JSON
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});
```

The `answers` column accumulates data as the user progresses: `{ name, skinType, routine, concern, allergies }`. On completion, these are flushed to the memory system and the `state` is set to `COMPLETE`.

### New Files

| File | Purpose |
|---|---|
| `src/lib/telegram/onboarding.ts` | State machine controller — given (state + user message), returns (next state + Telegram response with inline keyboard) |
| `src/lib/report/skin-profile.ts` | Profile card variant — wraps existing report card JSX, adds name + personality label + updated CTA |
| `src/lib/report/personality-labels.ts` | Maps (concern + skin type + score) → personality label |

### Modified Files

| File | Change |
|---|---|
| `src/lib/telegram/handler.ts` | 1. Modify `case "/start"` to check onboarding status and delegate to onboarding controller instead of always sending static welcome. 2. Before routing to Noor AI, check if user is mid-onboarding → delegate to onboarding controller. 3. Add `callback_query` handling for inline keyboard taps (currently only handles `message` updates). |
| `src/lib/telegram/client.ts` | Add `sendMessageWithKeyboard(chatId, text, inlineKeyboard)` method for sending messages with Telegram inline keyboard buttons. |
| `src/db/schema.ts` | Add `onboardings` table (see schema above). |

### Data Flow

```
User sends /start (first time)
    │
    ▼
/start handler: check onboarding state
    │ state != COMPLETE → delegate to onboarding controller
    │ state == COMPLETE → send normal welcome, route to Noor AI
    │
    ▼
Onboarding controller: step-by-step Q&A
    │ Tap questions → sent via sendMessageWithKeyboard()
    │ Responses arrive as callback_query (taps) or message (name/selfie)
    │
    ▼
Selfie received → existing scan pipeline (Gemini Vision)
    │ Send "Dekh rahi hoon... 👀" while processing
    │
    ▼
Scan results + answers → personality label picker
    │
    ▼
Noor AI generates text insights (scan + answers as context)
    → tg.sendMessage() — the personal touch, creates anticipation
    │
    ▼
buildProfileCardResponse(results, name, label, date)
    → ImageResponse → Buffer → tg.sendPhoto() — the "voilà" moment
    │
    ▼
"Want to work on [concern] together?" → tg.sendMessage()
    │
    ▼
Save answers to memory system → Mark onboarding COMPLETE
    │
    ▼
User replies → normal Noor chat (fully contextualized)
```

**Note:** Text insights are sent *before* the card image. This creates anticipation — Noor's personal read builds up to the visual payoff of the card.

### Memory Integration

After onboarding completes, all answers are saved to the existing memory system:

| Answer | Memory Category | Key |
|---|---|---|
| Name | identity | name |
| Skin type | identity | skin_type |
| Routine level | preference | routine_level |
| Main concern | health | primary_concern |
| Allergies | identity | allergies |
| Scan results | health | initial_scan |

All future Noor conversations load these memories automatically — no gap between onboarding and chat.

### Smart Skip Logic

Before each question, the controller checks existing memories:
- If memory has "name" → skip name step
- If memory has "skin_type" → skip skin type step
- etc.

Handles the case where someone chatted casually first, then later requests a skin analysis.

### Resume & Re-trigger

- **Resume:** User leaves mid-flow, comes back → handler checks state → picks up where they left off
- **Re-trigger:** Completed users send a new selfie or use the existing `/scan` command → runs the existing scan pipeline + generates a new report card (not the profile card). No new mechanism needed — the current selfie/scan flow already handles this.
- **Skipped users:** Picked "Bas baat karni hai" initially → Noor can naturally offer analysis later in conversation. When they accept, their state transitions from `skipped` → `awaiting_name` and the onboarding flow resumes.

### Callback Query Handling

Telegram inline keyboard taps arrive as `callback_query` updates, not `message` updates. The handler must be extended to:

1. Accept `callback_query` in the `TelegramUpdate` interface
2. Route callback queries to the onboarding controller
3. Answer callback queries with `answerCallbackQuery` to dismiss the loading state
4. For multi-select (allergies step): toggle selections and update the keyboard until user confirms

---

## Language Guidelines

- Use "tum/tumhari/tumhe" — never "tu/teri/tere"
- Hinglish tone: warm, casual, like a knowledgeable friend
- Keep tap-option text short and scannable
- Emojis are encouraged but not excessive
- English technical terms are fine (cleanser, moisturizer, serum)

---

## Deferred to Later Conversations

These are collected naturally by Noor after the onboarding gratification, not during:
- City (for weather/pollution context)
- Period cycle tracking
- Budget preference
- Specific product names in current routine
- Age (if relevant for recommendations)

---

## Success Criteria

- User completes onboarding in under 2 minutes (excluding selfie processing time)
- Card is generated and sent successfully
- User responds to "want to work on it?" prompt (engagement signal)
- Onboarding data is correctly saved to memory system
- Returning users are not re-onboarded
