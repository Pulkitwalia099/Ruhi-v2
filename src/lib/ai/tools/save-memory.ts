import { tool } from "ai";
import { z } from "zod";
import {
  upsertMemory,
  insertMemory,
  insertMomentMemory,
} from "@/db/queries";

const IDENTITY_KEYS = [
  "name",
  "age",
  "city",
  "gender",
  "skin_type",
  "allergies",
  "conditions",
  "life_stage",
] as const;

const PREFERENCE_KEYS = [
  "budget",
  "brands",
  "fragrance",
  "advice_style",
  "language",
  "remedies",
] as const;

export const saveMemory = tool({
  description:
    "Save important facts about the user to memory for future conversations. " +
    "Use for identity facts (name, skin type, city), health info (products, symptoms), " +
    "preferences (budget, brands), emotional moments (stress, events), " +
    "and short-lived context (travel, weather). Never save greetings or your own advice.",
  inputSchema: z.object({
    userId: z.string().describe("The user's database ID"),
    category: z.enum([
      "identity",
      "health",
      "preference",
      "moment",
      "context",
    ]),
    key: z
      .enum([...IDENTITY_KEYS, ...PREFERENCE_KEYS])
      .optional()
      .describe(
        "Required for identity and preference categories. Must match allowed keys.",
      ),
    value: z.string().describe("The memory content to save"),
    status: z
      .enum(["active", "resolved", "stopped", "recommended"])
      .optional()
      .describe(
        "For health entries: active (currently using), resolved (issue fixed), stopped (discontinued), recommended (you suggested this product/routine)",
      ),
    date: z
      .string()
      .optional()
      .describe("When the user mentions a specific date"),
  }),
  execute: async ({ userId, category, key, value, status, date }) => {
    try {
      // Validate: identity/preference require a key
      if (
        (category === "identity" || category === "preference") &&
        !key
      ) {
        return { saved: false, error: "key is required for " + category };
      }

      // Sanitize: health/moment/context should not have a key
      const cleanKey =
        category === "identity" || category === "preference" ? key! : null;

      // Build metadata
      const metadata: Record<string, unknown> = {};
      if (category === "health" && status) metadata.status = status;
      if (date) metadata.date = date;

      // Route to correct query
      switch (category) {
        case "identity":
        case "preference":
          await upsertMemory({
            userId,
            category,
            key: cleanKey!,
            value,
            metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
          });
          break;

        case "health":
          await insertMemory({
            userId,
            category: "health",
            value,
            metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
          });
          break;

        case "context":
          await insertMemory({
            userId,
            category: "context",
            value,
            metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
            expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          });
          break;

        case "moment":
          await insertMomentMemory({
            userId,
            value,
            metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
          });
          break;
      }

      return { saved: true, category, key: cleanKey };
    } catch (error) {
      console.error("[saveMemory] Failed:", error);
      return {
        saved: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});
