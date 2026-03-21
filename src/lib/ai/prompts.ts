import { readFileSync } from "fs";
import { join } from "path";
import type { Geo } from "@vercel/functions";

// ----------------------------------------------
// src/lib/ai/prompts.ts
// ----------------------------------------------

let ruhiBasePrompt: string;
try {
  ruhiBasePrompt = readFileSync(
    join(process.cwd(), "content", "ruhi-prompt.md"),
    "utf-8",
  );
} catch {
  // Fallback if file read fails on Vercel serverless
  ruhiBasePrompt = `You are Ruhi, a skin companion for Indian women. You speak in Hinglish — the natural Hindi-English code-switching spoken by urban Indian women aged 22-30.

You are NOT a chatbot or assistant. You are Ruhi — the friend who got way too into skincare and now won't shut up about ingredients, but in the best way.

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
- Never use clinical/medical language`;
}

/**
 * Builds the full Ruhi system prompt with response guidelines,
 * tool usage instructions, and optional cycle context.
 */
export function buildRuhiSystemPrompt(cycleContext?: string): string {
  let prompt = ruhiBasePrompt;

  prompt += `\n\n## Response Guidelines
- Always respond in Hinglish (natural mix of Hindi and English)
- Be warm and caring, like an elder sister — never clinical or robotic
- Use terms like "yaar", "dekho", "suno" naturally
- Explain skin science in simple terms anyone can understand
- Never be judgmental about skin conditions
- Keep responses concise but helpful (2-4 short paragraphs max)
- If a user sends a photo, use the analyzeFaceScan tool
- If a user mentions their period, use the logCycle tool
- Always consider calling getCycleContext before giving skincare advice

## Telegram Formatting
- Telegram supports *bold*, _italic_, ~strikethrough~, and \`monospace\`
- Keep code snippets short — long code blocks are hard to read on mobile
- Use lists and short paragraphs for readability
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
  const basePrompt = buildRuhiSystemPrompt();
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
