import { generateText, Output, tool } from "ai";
import { z } from "zod";
import { getLatestCycle, getRecentScans, insertScan } from "@/db/queries";
import { getLanguageModel } from "../providers";
import { VISION_MODEL } from "../models";
import { calculateCyclePhase } from "./cycle-utils";

const scanResultSchema = z.object({
  zones: z.object({
    forehead: z.object({
      condition: z.string(),
      severity: z.number().min(1).max(10),
      notes: z.string(),
    }),
    t_zone: z.object({
      condition: z.string(),
      severity: z.number().min(1).max(10),
      notes: z.string(),
    }),
    left_cheek: z.object({
      condition: z.string(),
      severity: z.number().min(1).max(10),
      notes: z.string(),
    }),
    right_cheek: z.object({
      condition: z.string(),
      severity: z.number().min(1).max(10),
      notes: z.string(),
    }),
    chin: z.object({
      condition: z.string(),
      severity: z.number().min(1).max(10),
      notes: z.string(),
    }),
    jawline: z.object({
      condition: z.string(),
      severity: z.number().min(1).max(10),
      notes: z.string(),
    }),
  }),
  overall_score: z.number().min(1).max(10),
  summary: z.string(),
});

export const analyzeFaceScan = tool({
  description:
    "Analyze a selfie photo for skin conditions across 6 facial zones. Call this when the user sends a photo of their face.",
  inputSchema: z.object({
    userId: z.string().describe("The user's ID"),
    imageBase64: z
      .string()
      .describe("The selfie image as a base64-encoded string"),
  }),
  execute: async ({ userId, imageBase64 }) => {
    // Get cycle context
    let cycleContext = "";
    let cycleDay: number | undefined;
    let cyclePhase: string | undefined;
    const cycle = await getLatestCycle({ userId });
    if (cycle) {
      const phase = calculateCyclePhase(
        cycle.periodStart,
        cycle.cycleLength,
      );
      cycleDay = phase.cycleDay;
      cyclePhase = phase.phase;
      cycleContext = `\nCycle context: Day ${phase.cycleDay}, ${phase.phase} phase. ${phase.skinImplications}`;
    }

    // Get recent scan history
    const recentScans = await getRecentScans({ userId, limit: 3 });
    let historyContext = "";
    if (recentScans.length > 0) {
      historyContext = `\nPrevious scans:\n${JSON.stringify(
        recentScans.map((s) => ({
          date: s.createdAt.toISOString().split("T")[0],
          results: s.results,
        })),
        null,
        2,
      )}`;
    }

    // Call Gemini Vision with structured output
    const { output } = await generateText({
      model: getLanguageModel(VISION_MODEL),
      output: Output.object({ schema: scanResultSchema }),
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `You are a dermatology-trained skin analysis AI. Analyze this selfie for skin conditions across 6 facial zones: forehead, t_zone, left_cheek, right_cheek, chin, jawline.\n\nFor each zone, assess:\n- condition: what you observe (acne, dryness, oiliness, clear, hyperpigmentation, texture issues, etc.)\n- severity: 1-10 scale (1 = perfect, 10 = severe concern)\n- notes: brief observation + actionable advice${cycleContext}${historyContext}\n\nAlso provide an overall_score (1-10, lower is better) and a friendly summary paragraph.`,
            },
            { type: "image", image: imageBase64 },
          ],
        },
      ],
    });

    if (!output) {
      return {
        error: true,
        message:
          "Could not analyze the photo. Please try again with a clearer selfie.",
      };
    }

    // Save to DB
    await insertScan({
      userId,
      scanType: "face",
      results: output as Record<string, unknown>,
      cycleDay,
      cyclePhase,
    });

    return output;
  },
});
