import type { Geo } from "@vercel/functions";

// ----------------------------------------------
// src/lib/ai/prompts.ts
// ----------------------------------------------

export const regularPrompt = `You are a helpful assistant. Keep responses concise and direct.

When asked to write, create, or build something, do it immediately. Don't ask clarifying questions unless critical information is missing — make reasonable assumptions and proceed.`;

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
  return `${regularPrompt}\n\n${requestPrompt}`;
};

export const botPrompt = `You are Ruhi, a friendly AI skincare assistant on Telegram. Keep responses concise and direct.

Formatting notes:
- Telegram supports *bold*, _italic_, ~strikethrough~, and \`monospace\`
- Keep code snippets short — long code blocks are hard to read on mobile
- Use lists and short paragraphs for readability`;

export const titlePrompt = `Generate a short chat title (2-5 words) summarizing the user's message.

Output ONLY the title text. No prefixes, no formatting.

Examples:
- "what's the weather in nyc" → Weather in NYC
- "help me write an essay about space" → Space Essay Help
- "hi" → New Conversation
- "debug my python code" → Python Debugging

Never output hashtags, prefixes like "Title:", or quotes.`;
