import { tool } from "ai";
import { z } from "zod";
import { getLatestCycle } from "@/db/queries";
import { calculateCyclePhase } from "./cycle-utils";

export const getCycleContext = tool({
  description:
    "Get the user's current menstrual cycle context including phase, cycle day, and skin implications. Call this when the user asks about their cycle, skin concerns related to hormones, or when you need cycle context for advice.",
  inputSchema: z.object({
    userId: z.string().describe("The user's ID"),
  }),
  execute: async ({ userId }) => {
    const latestCycle = await getLatestCycle({ userId });

    if (!latestCycle) {
      return {
        noCycleData: true,
        message:
          "No cycle data found. Ask the user when their last period started so you can track their cycle.",
      };
    }

    // Staleness check: if last period was logged >45 days ago, data is unreliable
    const daysSinceLogged = Math.floor(
      (Date.now() - latestCycle.periodStart.getTime()) / (1000 * 60 * 60 * 24),
    );
    const isStale = daysSinceLogged > latestCycle.cycleLength + 14;

    const phaseResult = calculateCyclePhase(
      latestCycle.periodStart,
      latestCycle.cycleLength,
    );

    return {
      noCycleData: false,
      isStale,
      staleWarning: isStale
        ? "Last period was logged " + daysSinceLogged + " days ago — this prediction may be inaccurate. Ask the user to update: 'Period kab aaya last? Update kar do toh better advice de paungi.'"
        : undefined,
      cycleDay: phaseResult.cycleDay,
      phase: phaseResult.phase,
      ovulationEstimate: phaseResult.ovulationEstimate,
      nextPeriodEstimate: phaseResult.nextPeriodEstimate,
      skinImplications: isStale
        ? phaseResult.skinImplications + " ⚠️ Note: this prediction is based on old data. Ask user to confirm their last period date."
        : phaseResult.skinImplications,
      cycleLength: latestCycle.cycleLength,
      periodStart: latestCycle.periodStart.toISOString().split("T")[0],
      daysSinceLogged,
    };
  },
});
