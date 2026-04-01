import { tool } from "ai";
import { z } from "zod";

/**
 * Web search tool for skincare knowledge — ingredients, products, brands, research.
 * Uses Serper (Google Search API) when SERPER_API_KEY is available.
 */
export const searchSkincareKnowledge = tool({
  description:
    "Search for skincare information — ingredients, products, brands, research. " +
    "Use when the user asks about a specific product you're not sure about, " +
    "wants current pricing/availability, or asks about recent skincare research.",
  inputSchema: z.object({
    query: z.string().describe(
      "The search query — be specific. E.g. 'Minimalist 10% niacinamide serum ingredients review' not just 'niacinamide'",
    ),
  }),
  execute: async ({ query }) => {
    const apiKey = process.env.SERPER_API_KEY;
    if (!apiKey) {
      return { error: "Search not configured", results: [] };
    }

    try {
      const res = await fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: {
          "X-API-KEY": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          q: `${query} skincare`,
          num: 5,
        }),
      });

      if (!res.ok) {
        return { error: `Search failed: ${res.status}`, results: [] };
      }

      const data = await res.json();
      const results = (data.organic || [])
        .slice(0, 5)
        .map((r: Record<string, unknown>) => ({
          title: r.title,
          snippet: r.snippet,
          link: r.link,
        }));

      return { results };
    } catch {
      return { error: "Search failed", results: [] };
    }
  },
});
