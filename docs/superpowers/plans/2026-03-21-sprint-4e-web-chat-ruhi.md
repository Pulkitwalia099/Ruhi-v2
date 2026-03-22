# Sprint 4E: Web Chat with Ruhi Persona — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect the Ruhi persona, memory system, skincare tools, and safety net to the web chat — so browser users get the same experience as Telegram users.

**Architecture:** The web chat route (`route.ts`) currently uses a generic system prompt with only `getWeather` as a tool. We swap to the Ruhi system prompt with memory injection, replace the tool set with Ruhi's skincare tools, inject the userId for tool calls, and add the post-hoc safety net. The UI shell already has artifacts disabled — we just update the landing suggestions to be skincare-themed.

**Tech Stack:** Next.js App Router, AI SDK v6 (`ToolLoopAgent`, `streamText`), Drizzle ORM, existing Ruhi tools

**Spec:** `docs/specs/2026-03-22-web-chat-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/app/(chat)/api/chat/route.ts` | Modify | Swap tools, add memory loading, inject userId, add safety net |
| `src/lib/constants.ts` | Modify | Update suggestion strings to skincare-themed |
| `src/components/chat/preview.tsx` | Modify | Update subtitle text from generic to Ruhi-themed |
| `src/components/chat/greeting.tsx` | Review | Check if it shows generic greeting text that needs updating |

---

## Task 1: Swap tools and add memory/userId to chat route

**Files:**
- Modify: `src/app/(chat)/api/chat/route.ts`

This is the core change. We need to:
1. Import Ruhi tools instead of getWeather
2. Load user memories before building the prompt
3. Pass memories into `buildRuhiSystemPrompt()`
4. Inject userId into the system prompt
5. Run safety net after response completes

- [ ] **Step 1: Update imports**

Replace the getWeather import and add new imports at the top of `route.ts`:

```typescript
// REMOVE this line:
import { getWeather } from "@/lib/ai/tools/get-weather";

// ADD these lines:
import { getCycleContext, logCycle, getScanHistory, saveMemory } from "@/lib/ai/tools";
import { loadAndFormatMemories } from "@/lib/memory/loader";
import { runPostHocSafetyNet } from "@/lib/memory/safety-net";
```

Also update the prompts import to use `buildRuhiSystemPrompt` directly:

```typescript
// CHANGE this:
import { type RequestHints, systemPrompt } from "@/lib/ai/prompts";

// TO this:
import { type RequestHints, getRequestPromptFromHints, buildRuhiSystemPrompt } from "@/lib/ai/prompts";
```

- [ ] **Step 2: Load memories and build Ruhi prompt**

In the `POST` function, after the `requestHints` block (around line 175) and before the `modelConfig` block (around line 192), add memory loading and build the full prompt:

```typescript
// Load user memories for Ruhi's system prompt
const memoriesBlock = await loadAndFormatMemories(session.user.id);

// Build Ruhi system prompt with memories + geo hints
const requestPrompt = getRequestPromptFromHints(requestHints);
const ruhiInstructions = buildRuhiSystemPrompt(undefined, memoriesBlock ?? undefined)
  + `\n\n## Internal Context\nThe current user's database ID is: ${session.user.id}\nAlways use this exact ID when calling tools like getCycleContext, logCycle, getScanHistory, or saveMemory.`
  + `\n\n${requestPrompt}`;
```

- [ ] **Step 3: Update the agent config to use Ruhi tools and prompt**

Replace the `cfg` object (around lines 199-211):

```typescript
// CHANGE this:
const cfg = {
  model: getLanguageModel(chatModel),
  instructions: systemPrompt({ requestHints, supportsTools }),
  activeTools:
    isReasoningModel && !supportsTools
      ? []
      : ["getWeather"],
  providerOptions: {
    ...(modelConfig?.reasoningEffort && {
      openai: { reasoningEffort: modelConfig.reasoningEffort },
    }),
  },
};

// TO this:
const ruhiTools = { getCycleContext, logCycle, getScanHistory, saveMemory };

const cfg = {
  model: getLanguageModel(chatModel),
  instructions: ruhiInstructions,
  activeTools:
    isReasoningModel && !supportsTools
      ? []
      : Object.keys(ruhiTools),
  providerOptions: {
    ...(modelConfig?.reasoningEffort && {
      openai: { reasoningEffort: modelConfig.reasoningEffort },
    }),
  },
};
```

- [ ] **Step 4: Update agent creation to use Ruhi tools**

In the `createUIMessageStream` execute block (around line 216-226):

```typescript
// CHANGE this:
const agent = createChatAgent({
  ...cfg,
  tools: {
    getWeather,
  },
});

// TO this:
const agent = createChatAgent({
  ...cfg,
  tools: ruhiTools,
});
```

- [ ] **Step 5: Add safety net in onFinish**

In the `onFinish` callback, after the message saving logic (after the closing `}` of the else-if block around line 270), add:

```typescript
// Post-hoc safety net: catch identity facts the LLM may have missed
const lastUserMsg = uiMessages.filter(m => m.role === "user").pop();
if (lastUserMsg) {
  const userText = lastUserMsg.parts
    ?.filter((p: any) => p.type === "text")
    .map((p: any) => p.text)
    .join("") ?? "";
  if (userText) {
    runPostHocSafetyNet(session.user.id, userText).catch((err) =>
      console.error("[SafetyNet] Web chat:", err),
    );
  }
}
```

- [ ] **Step 6: Verify the build compiles**

Run: `npx next build 2>&1 | head -30` or `npx tsc --noEmit`
Expected: No type errors related to the changed imports/tools

- [ ] **Step 7: Commit**

```bash
git add src/app/(chat)/api/chat/route.ts
git commit -m "feat(4E): connect Ruhi tools, memory, and safety net to web chat"
```

---

## Task 2: Update landing page suggestions to skincare-themed

**Files:**
- Modify: `src/lib/constants.ts`
- Modify: `src/components/chat/preview.tsx`

- [ ] **Step 1: Update suggestion strings**

In `src/lib/constants.ts`, replace the suggestions array (lines 21-26):

```typescript
// CHANGE this:
export const suggestions = [
  "What are the advantages of using Next.js?",
  "Write code to demonstrate Dijkstra's algorithm",
  "Help me write an essay about Silicon Valley",
  "What is the weather in San Francisco?",
];

// TO this:
export const suggestions = [
  "My skin feels super dry after washing — kya karu?",
  "Best sunscreen under ₹500 for oily skin?",
  "Niacinamide aur salicylic acid saath mein use kar sakti hoon?",
  "My period just started — skin ke liye kya change karu?",
];
```

- [ ] **Step 2: Update preview.tsx subtitle**

In `src/components/chat/preview.tsx`, update the heading and subtitle (around lines 33-37):

```tsx
// CHANGE this:
<h2 className="text-xl font-semibold tracking-tight">
  What can I help with?
</h2>
<p className="mt-1.5 text-sm text-muted-foreground">
  Ask a question, write code, or explore ideas.
</p>

// TO this:
<h2 className="text-xl font-semibold tracking-tight">
  Hey! Main Ruhi hoon 👋
</h2>
<p className="mt-1.5 text-sm text-muted-foreground">
  Your skincare companion — poocho jo puchna hai!
</p>
```

- [ ] **Step 3: Verify the build compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/constants.ts src/components/chat/preview.tsx
git commit -m "feat(4E): update landing suggestions and greeting to Ruhi persona"
```

---

## Task 3: Check greeting component and clean up unused import

**Files:**
- Review: `src/components/chat/greeting.tsx`
- Modify: `src/app/(chat)/api/chat/route.ts` (remove unused `systemPrompt` import if still present)

- [ ] **Step 1: Review greeting.tsx**

Read `src/components/chat/greeting.tsx` — check if it displays any generic chatbot text that should be updated to Ruhi's voice. If it does, update the greeting text.

- [ ] **Step 2: Clean up unused imports in route.ts**

Verify that the old `systemPrompt` function is no longer imported (we replaced it with `buildRuhiSystemPrompt` + `getRequestPromptFromHints`). Also verify `getWeather` import is removed.

- [ ] **Step 3: Final build check**

Run: `npx tsc --noEmit`
Expected: No errors, no unused import warnings

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(4E): update greeting component and clean up imports"
```

---

## Task 4: Manual smoke test

- [ ] **Step 1: Start dev server**

Run: `npm run dev`

- [ ] **Step 2: Open web chat**

Navigate to `http://localhost:3000`. Verify:
- Landing page shows Ruhi greeting and skincare suggestions
- Clicking a suggestion sends it as a message

- [ ] **Step 3: Test Ruhi persona**

Send: "hey, my skin is super oily lately"
Verify:
- Response is in Ruhi's Hinglish voice (not generic chatbot)
- If you mention your name, the saveMemory tool should be called

- [ ] **Step 4: Test cycle tool**

Send: "my period started today"
Verify:
- The logCycle tool is called (visible in server logs or tool call parts in the UI)
- Ruhi acknowledges naturally without saying "Memory saved!"

- [ ] **Step 5: Verify safety net runs**

Check server logs for `[SafetyNet]` entries after sending messages with identity info like "I'm from Mumbai" or "my skin type is oily"
