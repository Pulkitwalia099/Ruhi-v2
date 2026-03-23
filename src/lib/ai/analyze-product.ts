import { generateText } from "ai";

import { getLanguageModel } from "@/lib/ai/providers";
import { VISION_MODEL } from "@/lib/ai/models";

/**
 * Analyze a product photo (label, bottle, Nykaa screenshot).
 * Reads ingredients and gives a personalized verdict based on user context.
 *
 * Called directly from the Telegram handler — NOT an LLM tool
 * (the model can't call itself with an image).
 */
export async function analyzeProductPhoto(
  imageBuffer: Buffer,
  userId: string,
  memoriesBlock?: string,
): Promise<string> {
  const result = await generateText({
    model: getLanguageModel(VISION_MODEL),
    system: `You are Noor — a skincare bestie who talks in warm, natural Hinglish.
Read the product name and ingredient list from the image.
${memoriesBlock || ""}

How to respond:
1. Start with a quick REACTION — your gut feeling about this product for this user ("Oho yaar yeh toh..." / "Hmm, interesting choice..." / "Nice pick!"). This goes in the first message.
2. Then break down: what's good (active ingredients) and what's problematic (SLS, comedogenic stuff, fragrance, parabens) — explain WHY it matters for this user's specific skin.
3. End with a clear verdict: X/10 with a one-liner, and if not suitable, suggest ONE specific alternative product with why it's better.

IMPORTANT formatting rules:
- Use ||| to split your response into 2-3 separate messages (reaction, analysis, verdict). This creates natural chat pacing.
- Talk like a friend giving honest advice, NOT a lab report. "Yeh pores clog karega" not "This contains comedogenic ingredients."
- Keep technical depth — name actual ingredients and explain them — but wrap it in casual Hinglish.
- Total response: 4-6 sentences across all messages. Don't over-explain.
- If you can't read the label clearly, say so casually and ask for a closer photo.`,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", image: imageBuffer },
          { type: "text", text: "Analyze this product for my skin." },
        ],
      },
    ],
  });

  return (
    result.text ||
    "Sorry yaar, product analyze nahi ho paya. Ek aur photo bhejo thoda close up mein."
  );
}

/**
 * Classify whether a photo is a selfie/face or a product/label.
 * Uses BOTH the image AND the user's text context (caption + recent messages)
 * to make the decision. Defaults to "selfie" on any error.
 */
export async function classifyPhotoIntent(
  imageBuffer: Buffer,
  context?: { caption?: string; recentMessages?: string },
): Promise<"selfie" | "product"> {
  try {
    let contextHint = "";
    if (context?.caption) {
      contextHint += `\nThe user sent this caption with the photo: "${context.caption}"`;
    }
    if (context?.recentMessages) {
      contextHint += `\nRecent conversation context:\n${context.recentMessages}`;
    }

    const result = await generateText({
      model: getLanguageModel(VISION_MODEL),
      messages: [
        {
          role: "user",
          content: [
            { type: "image", image: imageBuffer },
            {
              type: "text",
              text: `Classify this photo using BOTH the image AND the conversation context. Reply with exactly one word:
- 'selfie' = a person's face/skin is the main subject (skin check, selfie, face close-up)
- 'product' = the main subject is a product bottle, label, ingredient list, or shopping screenshot (no face as main subject)

Important rules:
- If a face is clearly visible as the main subject, it's ALWAYS a selfie — even if products are nearby
- If the user's caption or recent messages mention skin check, scan, or analysis, lean towards 'selfie'
- If the user's caption mentions a product name or asks about ingredients, lean towards 'product'
- When in doubt, reply 'selfie'
${contextHint}`,
            },
          ],
        },
      ],
    });

    const intent = result.text.trim().toLowerCase();
    return intent.includes("product") ? "product" : "selfie";
  } catch (error) {
    console.error("[Noor] Photo intent classification failed, defaulting to selfie:", error);
    return "selfie";
  }
}
