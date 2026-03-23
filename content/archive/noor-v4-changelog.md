# Noor v4.0 — Change Log & Testing Guide

## What Changed and Why

### REMOVED (with reasoning)

| What was removed | Why | Risk of removal |
|---|---|---|
| CAPABILITIES section ("never say coming soon") | Never triggered in 208 messages across 8 chats. Phantom problem. ~100 wasted tokens. | Low. If it resurfaces, add back as a 1-line rule. |
| "What BAD Hinglish sounds like" (5 examples) | Gemini 2.5 Pro doesn't generate "Kripya sunscreen lagayein" on its own. Defensive prompting against non-existent failure. ~80 tokens. | Very low. Not observed in any conversation. |
| "Your name means Glow in Urdu/Hindi" | Never surfaced in any conversation. Confirmed removable by Pulkit. | Zero. |
| Step 1.5 "Set expectations" in SOP | ROOT CAUSE of question bombardment. Model reads this as "collect skin type, products, cycle, AND photo before answering." Causes the intake-form behavior seen in every chat. | Medium-positive. Removing this IMPROVES behavior. |
| RESPONSE VARIATION section | Good principle but prescriptive examples cause mechanical rotation. Core idea ("vary your openings") folded into Voice rules as a 1-line instruction. | Low. The principle is preserved. |
| ANTI-PATTERNS table | 100% redundant — every rule already stated in its relevant section. Tables are expensive tokens for Gemini. | Zero. All rules still present. |
| "What you NEVER do" + "When to escalate" | ROOT CAUSE of silent deflection. "Never diagnose" + no fallback behavior = model pretends question wasn't asked. Replaced by BOUNDARIES section with explicit fallback behaviors. | Zero — replaced, not just removed. |

### ADDED (with reasoning)

| What was added | Problem it fixes | Evidence |
|---|---|---|
| BOUNDARIES — Friend-First Approach | Botox asked 3x, answered about microneedling. Abdomen pain completely ignored. "Tum mere question ka answer nai kar rahi ho" said twice. | Telegram Chat 8217194385 |
| Golden Rule ("response MUST contain word X") | Silent deflection on edge topics. Model talks about Y when asked about X. | Botox → microneedling redirect, abdomen pain → ignored |
| "React, Reason, Ask (max 1-2)" pattern | Question bombardment. 5 bare questions in one message. Users complain: "itne saare Qs ek baar mein", "stop asking sooo many questions" | Web Chat 57f1c44f, Telegram Chat 8217194385, old prompt Chat 0dcce491 |
| Friendship-building mission + conversational pull | Noor helps and hangs up. Conversations end flat. No relationship deepening. Every response should have a reason for the conversation to continue. | "Jao skincare karo! 💙" — multiple chats end transactionally |
| Zone-by-zone scan analysis (restored) | V3.0 draft removed zone detail. But zone-by-zone is where Noor's expertise shows and users find it valuable. | Telegram Chat 8217194385 — user engaged deeply with scan results |
| Proactive home remedy suggestions | Home remedies only triggered when user explicitly asks. But they're a natural trust-builder and conversation extender. | Product strategy: home remedies are part of Noor's knowledge base |
| Home remedy preference → memory save | No mechanism to stop suggesting if user doesn't want them. | New feature — prevents annoying repeat suggestions |
| Memory as HARD RULE with Hinglish examples | Zero preference/context/moment memories saved out of ~11 saveable facts. Only identity/products captured. | memories.json shows 0 preferences, 0 contexts, 0 moments |
| Hinglish pattern-matching for memory | Gender not inferred from verb forms. Budget not captured from "thoda flexible". Advice style not captured from complaints. | Telegram analysis |
| Stronger ||| enforcement (3+ sentences = mandatory) | Even with ||| rules, chunks are 3-4 sentences each. Total responses still too long. | Chat 8758897334, user feedback |
| 7 few-shot examples (up from 5) | Added botox and period pain examples — each showing boundary behavior + conversational pull. Voice section is where Gemini pays MOST attention. | Boundary behavior encoded in examples, not just rules |
| Vulnerability = good (Emotional Intelligence rewrite) | V3.0 said "minimal or zero advice" for emotional moments — this shuts conversations down. Validate THEN gently advise THEN keep door open. | "Overthink mat kar" = dismissive. Users need validation + engagement. |

### COMPRESSED (with reasoning)

| What was compressed | How | Token savings |
|---|---|---|
| SOP → "React, Reason, Ask" | 5-step rigid process → 1 principle with examples. Removes the checklist the model was following mechanically. | ~200 tokens |
| Response Length + Message Splitting → "HOW TO TALK" | Combined into one section. No more conflicting rules across two sections. | ~100 tokens |
| Emotional Intelligence + 3AM Mode → One section | Were two sections saying related things. Now one section with 3AM as a sub-rule. | ~80 tokens |
| Context Awareness | 15 sentences → 5 sentences. Same rules, less verbosity. | ~100 tokens |
| Voice rules | Removed redundant "never use" items that duplicate the examples. | ~50 tokens |

---

## Testing Priorities (Test These First)

### P0 — Test immediately (these are the behaviors most likely to regress or improve)

**Test 1: Question bombardment (should be FIXED)**
Send: "meri skin pe acne aa raha hai"
Expected: 1 question, with reasoning. NOT a list of 4-5 questions.
What to watch: If Noor asks more than 1 question in a single message, the "React, Reason, Ask" section isn't working.

**Test 2: Silent deflection on procedures (should be FIXED)**
Send: "kya muje botox karana chaiye?"
Expected: Noor says "botox" in her response, gives her take, suggests derm for final call.
What to watch: If Noor talks about retinol or microneedling WITHOUT mentioning botox, the Golden Rule isn't working.

**Test 3: Silent deflection on non-skin health (should be FIXED)**
Send: "periods se pehle bohot abdomen pain hota hai, kya karna chaiye?"
Expected: Noor gives practical advice (hot compress, light walk), connects to skin if relevant, suggests gyno if serious.
What to watch: If Noor ignores the question or redirects to skincare only, BOUNDARIES section isn't working.

**Test 4: Message length + conversational pull (should feel like a friend)**
Send: "which moisturizer should I use for oily skin?"
Expected: Ask 1-2 key questions (skin type confirmed, budget), or if already known, suggest directly + a conversational pull ("Waise cleanser kya use karti ho?").
What to watch: If response is just a product name with no pull (feels transactional), or if it's 6+ sentences (still too long).

### P1 — Test next (important but lower risk)

**Test 5: Memory saving — preferences**
Send: "itne saare questions mat poocho ek baar mein"
Expected: Noor adjusts behavior AND saves preference (advice_style: "prefers fewer questions").
How to verify: Check memories table for a preference row after this conversation.

**Test 6: Memory saving — gender from Hindi grammar**
Send: "mai 3 mahine se yeh serum use kar rahi hoon"
Expected: Noor saves gender: female (from "kar rahi hoon") AND the product with duration.
How to verify: Check memories table for identity/gender: female.

**Test 7: Context awareness — don't re-ask**
First share skin type, then later ask a question that depends on skin type.
Expected: Noor uses the remembered skin type, doesn't ask again.
What to watch: If Noor asks "skin type kya hai?" when it's already in memory.

**Test 8: Scan results — zone-by-zone + pull**
Send a selfie for analysis.
Expected: Zone-by-zone breakdown with score. Ends with a conversational pull: "Detail mein bataaun routine?" or "Kuch specific zone pe focus karna hai?"
What to watch: If response is too short (just a score), or if it ends closed with no pull.

### P2 — Test when P0/P1 are stable

**Test 9: Emotional intelligence — validate AND keep going**
Send: "I hate my skin so much nothing works I give up"
Expected: Validation + normalization + small actionable thing OR a question that shows care. NOT just "overthink mat kar" (dismissive). NOT a full routine dump.
What to watch: If Noor dismisses and shuts down ("kal theek hoga"), or if she dumps a 10-step routine. The right middle: validate, then gently pull them back into conversation.

**Test 10: Drip behavior — user asks for more**
Send a skin concern → Noor gives initial take → User says "haan detail mein batao"
Expected: Noor NOW gives the detailed answer she held back.
What to watch: If Noor gives full detail upfront without waiting, or gives nothing when asked for more.

**Test 11: Home remedies — proactive suggestion**
Send: "cheeks pe dryness hai bohot"
Expected: Noor gives product advice AND proactively suggests a home remedy if relevant ("Aloe vera bhi laga sakti ho soothing ke liye"). Should feel natural, not forced.
What to watch: If Noor only gives product advice and never mentions home remedies, the proactive suggestion isn't working.

**Test 12: Home remedy rejection → memory save**
First send a concern, Noor suggests a home remedy, then say: "gharelu nuskhe nahi chahiye yaar"
Expected: Noor stops suggesting home remedies AND saves preference (remedies: "not interested").
How to verify: Check memories table for preference/remedies row.

**Test 13: Conversation continuity — Noor doesn't hang up**
Send: "okay thanks" after receiving advice.
Expected: Noor doesn't just say "bye!" — she pivots naturally: "Welcome! Waise aur kuch chal raha hai skin mein?" or "2 weeks mein update dena kaisa gaya."
What to watch: If Noor ends the conversation flat ("Jao skincare karo! 💙"), the friendship-building principle isn't working.

---

## Potential Pitfalls

### Pitfall 1: Noor becomes TOO chatty / over-pulls
**Signal:** Every response ends with a question even when the conversation naturally concluded. Feels clingy.
**Cause:** "Every response should have a pull" over-indexed.
**Fix:** The rule says "Don't force it every time." If it's still too much, add: "If the user says 'okay thanks' or 'bye', one gentle pull is fine. Two is clingy."

### Pitfall 2: Noor hypothesizes incorrectly with too much confidence
**Signal:** "Yeh X hai" when it's actually Y, and user feels misdiagnosed.
**Cause:** "React, Reason, Ask" encourages giving a take before full context.
**Fix:** The examples model the right confidence level ("usually", "lagta hai", "ho sakta hai"). If it's still too confident, add: "Frame your take as a possibility, not a diagnosis."

### Pitfall 3: Noor over-shares on medical topics
**Signal:** "Haan botox kara lo, bilkul safe hai" without nuance.
**Cause:** Loosened boundaries interpreted as "anything goes."
**Fix:** The boundary section has "derm se confirm kara lena" baked in for every category. If it's still too enthusiastic, add: "For procedures and medication, always end with 'derm se ek baar baat karo.'"

### Pitfall 4: ||| used too aggressively
**Signal:** 2-sentence responses split into 2 messages, feeling choppy.
**Cause:** "3+ sentences = MUST split" interpreted as "always split even short responses."
**Fix:** The rule says "1-2 sentences: No split needed." If it still splits short messages, change to: "Only split when a natural pause exists between reaction and advice."

### Pitfall 5: Memory becomes noisy
**Signal:** Redundant entries, saving obvious things ("okay" as a preference).
**Cause:** "Err on the side of saving."
**Fix:** The scanning checklist has specific categories. If noise increases, add an explicit "WHEN NOT to save: greetings, thank-yous, 'okay', conversational filler, things already in memory."

### Pitfall 6: Door-opening becomes a crutch
**Signal:** Every response ends with "detail mein bataaun?" even for simple answers.
**Cause:** Model latches onto one pull pattern.
**Fix:** The prompt gives 4 different pull types (door, pivot, care question, home remedy). If it still repeats one, add: "Vary your pulls like you vary your openings — never use the same one twice in a row."

### Pitfall 7: Home remedy suggestions feel forced
**Signal:** Noor suggests aloe vera for every problem, or suggests home remedies when the user clearly wants product recs.
**Cause:** "Proactively suggest" interpreted as "always suggest."
**Fix:** The rule says "when you know a home remedy is genuinely effective." If over-triggered, add: "Only suggest home remedies when they're actually the best or complementary option for this specific issue."

---

## Section-by-Section Token Estimate

| Section | v3.0 tokens (est.) | v4.0 tokens (est.) | Change |
|---|---|---|---|
| IDENTITY | 150 | 150 | +0 (added friendship mission, removed Glow/capabilities) |
| VOICE | 600 | 600 | +0 (removed bad hinglish, added 2 richer examples with pulls) |
| HOW TO TALK | 400 (split across 2 sections) | 380 | -20 (merged, added pull principle) |
| HOW TO HELP | 500 | 400 | -100 (principle > checklist, added proactive home remedies) |
| BOUNDARIES | 0 (didn't exist) | 450 | +450 (new, critical) |
| SCANS | 200 | 150 | -50 (compressed, zone-by-zone kept, pull added) |
| EMOTIONAL INTELLIGENCE | 300 (split across 2 sections) | 220 | -80 (merged, vulnerability rewrite) |
| MEMORY | 0 (was in separate appendix) | 400 | +400 (new in base prompt) |
| CONTEXT AWARENESS | 250 | 100 | -150 (compressed) |
| ANTI-PATTERNS | 150 | 0 | -150 (removed) |
| **TOTAL** | **~2550** | **~2850** | **+300 tokens** |

+300 tokens net, but this includes 850 tokens of genuinely new behavior (boundaries + memory) that previously either didn't exist or was in a separate appended block. The memory instructions from `prompts.ts` (~300 tokens) are now baked into the base prompt, so the combined system prompt is roughly the same total size as v3.0 base + v3.0 appended memory.
