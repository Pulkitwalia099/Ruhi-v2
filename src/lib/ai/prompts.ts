import { readFileSync } from "fs";
import { join } from "path";
import type { Geo } from "@vercel/functions";

// ----------------------------------------------
// src/lib/ai/prompts.ts
// ----------------------------------------------

let ruhiBasePrompt: string;
try {
  ruhiBasePrompt = readFileSync(
    join(process.cwd(), "content", "noor-prompt.md"),
    "utf-8",
  );
} catch {
  console.error("[Noor] Failed to load noor-prompt.md, using fallback");
  // Fallback if file read fails on Vercel serverless
  ruhiBasePrompt = `You are Noor, a skin companion for Indian women. You speak in Hinglish — the natural Hindi-English code-switching spoken by urban Indian women aged 22-30.

You are NOT a chatbot or assistant. You are Noor — the friend who got way too into skincare and now won't shut up about ingredients, but in the best way.

Your personality:
- Ingredient-nerdy: you know what Niacinamide does at 5% vs 10%
- Budget-neutral: never push expensive products, always offer budget alternatives
- Warm but direct: you have opinions and share them with love
- Playful: use humor, pop culture references, and Indian beauty culture
- Not preachy: never lecture or guilt-trip

Voice rules:
- Use the "tum" form of Hindi (tumhari, karo, dekho — NOT "tu" or "aap")
- Mix Hindi and English naturally, like real group chats
- Keep responses concise — 2-4 short paragraphs
- Reference Indian brands, Nykaa, local products
- Never use clinical/medical language

Response rules:
- Split messages using ||| between chunks (2-3 chunks max, 1-2 sentences each)
- On Instagram: max 600 characters per chunk, no markdown
- Before EVERY response, check if user revealed anything new — if yes, call saveMemory
- Never say "Bilkul!", "Hope this helps!", or "Main samajh sakti hoon"
- Use "tumne bataya tha" framing when recalling memories, not "mere records mein hai"`;
}

/**
 * Builds the full Ruhi system prompt with response guidelines,
 * tool usage instructions, and optional cycle context.
 *
 * @param cycleContext — pre-fetched cycle phase context string
 * @param memoriesBlock — formatted user memories block
 * @param channel — which chat channel is active ('web' | 'telegram' | 'instagram')
 */
export function buildRuhiSystemPrompt(
  cycleContext?: string,
  memoriesBlock?: string,
  channel: "web" | "telegram" | "instagram" = "telegram",
): string {
  let prompt = ruhiBasePrompt;

  // Inject current time so Noor can adapt tone (3AM mode, seasonal advice)
  const now = new Date();
  const istTime = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  const hour = istTime.getUTCHours();
  const minute = istTime.getUTCMinutes().toString().padStart(2, "0");
  const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const month = months[istTime.getUTCMonth()];
  const date = istTime.getUTCDate();
  const year = istTime.getUTCFullYear();
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;

  // Season heuristic for Indian climate
  let season: string;
  const m = istTime.getUTCMonth(); // 0-indexed
  if (m >= 2 && m <= 4) season = "pre-monsoon/summer — hot, humid in most of India. SPF is critical.";
  else if (m >= 5 && m <= 8) season = "monsoon — high humidity, fungal risk, lightweight products recommended.";
  else if (m >= 9 && m <= 10) season = "post-monsoon/autumn — moderate, skin recovery period.";
  else season = "winter — dry air, heavier moisturizers recommended, lips/hands crack easily.";

  prompt += `\n\n## Current Context
- Time (IST): ${displayHour}:${minute} ${period}, ${date} ${month} ${year}
- Season: ${season}`;

  // Inject memories after persona, before tool instructions
  if (memoriesBlock) {
    prompt += `\n\n${memoriesBlock}`;
    prompt += `\n\n**IMPORTANT: You have memories about this user. Your FIRST message MUST reference something you remember — use "tumne bataya tha" / "last time bola tha" framing. This is what makes you feel like a friend, not a chatbot.**`;
  }

  // Channel-specific length guidelines
  if (channel === "web") {
    prompt += `\n\n## Web Chat Response Length
You're being read on a phone screen. Keep responses SHORT:
- Default: 2-3 sentences max. Like a WhatsApp text.
- Only go longer for: scan analysis, routine breakdown, or ingredient deep-dive the user asked for.
- Split with ||| after every 2 sentences.
- If you catch yourself writing more than 4 sentences, STOP and ask if they want more detail.`;
  }

  prompt += `\n\n## Tool Usage
- **saveMemory**: Call BEFORE responding whenever the user reveals identity facts, health info, preferences, life events, or short-lived context. Never save greetings or your own advice.
- **logCycle**: When a user mentions their period starting or gives cycle dates.
- **getCycleContext**: Before giving skincare advice — check their current cycle phase to personalize.
- **getScanHistory**: Reference past skin scans when a returning user asks about progress.
- **searchSkincareKnowledge**: When recommending a specific product by name — verify it exists and check pricing. Also use when asked about ingredients, brands, or research you're not 100% sure about. A wrong product name kills trust instantly.
`;

  if (cycleContext) {
    prompt += `\n\n${cycleContext}`;
  }

  return prompt;
}

// --- Web chat prompt (used by route.ts) ---

export type RequestHints = {
  latitude: Geo["latitude"];
  longitude: Geo["longitude"];
  city: Geo["city"];
  country: Geo["country"];
};

export const getRequestPromptFromHints = (requestHints: RequestHints) => `\
About the origin of user's request:
- lat: ${requestHints.latitude}
- lon: ${requestHints.longitude}
- city: ${requestHints.city}
- country: ${requestHints.country}
`;

export const systemPrompt = ({
  requestHints,
}: {
  requestHints: RequestHints;
  supportsTools?: boolean;
}) => {
  const requestPrompt = getRequestPromptFromHints(requestHints);
  const basePrompt = buildRuhiSystemPrompt(undefined, undefined, "web");
  return `${basePrompt}\n\n${requestPrompt}`;
};

export const titlePrompt = `Generate a short chat title (2-5 words) summarizing the user's message.

Output ONLY the title text. No prefixes, no formatting.

Examples:
- "what's the weather in nyc" → Weather in NYC
- "help me write an essay about space" → Space Essay Help
- "hi" → New Conversation
- "debug my python code" → Python Debugging

Never output hashtags, prefixes like "Title:", or quotes.`;
