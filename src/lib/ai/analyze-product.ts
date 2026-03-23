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
    system: `You are Noor, a skincare expert analyzing a product photo.
Read the product name and ingredient list from the image.
${memoriesBlock || ""}

Analyze:
1. Key active ingredients and what they do
2. Any problematic ingredients (SLS, high-comedogenic, fragrance, parabens)
3. Suitability for this user's skin type and concerns
4. Overall verdict: X/10 with one-line reasoning
5. If not suitable, suggest a specific alternative product

Respond in Hinglish. Keep it concise — 3-4 sentences max.
If you can't read the label clearly, say so and ask for a clearer photo.`,
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
