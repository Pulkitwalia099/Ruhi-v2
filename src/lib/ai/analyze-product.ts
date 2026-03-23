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
 * Returns "selfie" or "product". Defaults to "selfie" on any error
 * so the existing scan pipeline is always the safe fallback.
 */
export async function classifyPhotoIntent(
  imageBuffer: Buffer,
): Promise<"selfie" | "product"> {
  try {
    const result = await generateText({
      model: getLanguageModel(VISION_MODEL),
      messages: [
        {
          role: "user",
          content: [
            { type: "image", image: imageBuffer },
            {
              type: "text",
              text: "Classify this photo. Reply with exactly one word:\n- 'selfie' = a person's face occupies most of the frame (even if products are visible in the background)\n- 'product' = the main subject is a product bottle, label, ingredient list, or shopping screenshot (no face as main subject)\nIf unclear, reply 'selfie'.",
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
