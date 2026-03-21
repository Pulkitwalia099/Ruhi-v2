import { tool } from "ai";
import { z } from "zod";
import { insertCycle } from "@/db/queries";
import { calculateCyclePhase } from "./cycle-utils";

export const logCycle = tool({
  description:
    "Log the start of a user's menstrual period. Call this when the user says their period started, provides a period start date, or wants to update their cycle information.",
  inputSchema: z.object({
    userId: z.string().describe("The user's ID"),
    periodStartDate: z
      .string()
      .describe("The date the period started in YYYY-MM-DD format"),
    cycleLength: z
      .number()
      .optional()
      .default(28)
      .describe(
        "The user's average cycle length in days. Defaults to 28 if not provided.",
      ),
  }),
  execute: async ({ userId, periodStartDate, cycleLength }) => {
    const periodStart = new Date(periodStartDate);

    const inserted = await insertCycle({
      userId,
      periodStart,
      cycleLength,
    });

    const phaseResult = calculateCyclePhase(periodStart, cycleLength);

    return {
      success: true,
      cycleId: inserted.id,
      periodStart: periodStartDate,
      cycleLength,
      currentPhase: phaseResult.phase,
      cycleDay: phaseResult.cycleDay,
      skinImplications: phaseResult.skinImplications,
      nextPeriodEstimate: phaseResult.nextPeriodEstimate,
    };
  },
});
