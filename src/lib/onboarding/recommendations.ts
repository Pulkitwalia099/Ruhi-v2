import { generateText } from "ai";

/**
 * Generates personalized product recommendations + optional home remedy
 * based on scan results and onboarding answers.
 * Shared module — usable by both Telegram and Instagram.
 */
export async function generateRecommendationText(
  scanResult: { overall_score: number; key_concerns: string[]; positives: string[] },
  answers: { skinType?: string; concern?: string; routine?: string; allergies?: string[] },
  includeHomeRemedy: boolean,
): Promise<string> {
  const { getLanguageModel } = await import("@/lib/ai/providers");
  const { DEFAULT_CHAT_MODEL } = await import("@/lib/ai/models");

  const context = [
    `Skin type: ${answers.skinType ?? "unknown"}`,
    `Main concern: ${answers.concern ?? "overall"}`,
    `Current routine: ${answers.routine ?? "unknown"}`,
    answers.allergies?.length ? `Allergies: ${answers.allergies.join(", ")}` : null,
    `Scan score: ${scanResult.overall_score}/10`,
    `Key concerns: ${scanResult.key_concerns.join(", ")}`,
  ].filter(Boolean).join("\n");

  const prompt = includeHomeRemedy
    ? `Based on this skin profile, suggest 2-3 specific product recommendations (Indian market — Minimalist, CeraVe, Neutrogena, Dot & Key, mix of budget and mid-range) AND 1 effective home remedy. Be specific with product names and approx prices.\n\n${context}`
    : `Based on this skin profile, suggest 2-3 specific product recommendations (Indian market, mix of budget and mid-range). Be specific with product names and approx prices.\n\n${context}`;

  const result = await generateText({
    model: getLanguageModel(DEFAULT_CHAT_MODEL),
    system: "You are Noor. You just analyzed this person's skin and they want recommendations. Talk like you're texting a friend. Direct, specific, no 'Hello!' or 'Here are my recommendations'. Jump straight into the suggestion. Hinglish, tum form. Under 500 chars. Use ||| to split into 2-3 messages. No markdown. No em dashes. Be specific with product names, prices, and where to buy (Nykaa, Amazon).",
    messages: [{ role: "user", content: prompt }],
  });

  return result.text || "Recommendations abhi generate nahi ho payi, next time poocho! 💕";
}
