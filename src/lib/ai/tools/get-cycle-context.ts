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

    const phaseResult = calculateCyclePhase(
      latestCycle.periodStart,
      latestCycle.cycleLength,
    );

    return {
      noCycleData: false,
      cycleDay: phaseResult.cycleDay,
      phase: phaseResult.phase,
      ovulationEstimate: phaseResult.ovulationEstimate,
      nextPeriodEstimate: phaseResult.nextPeriodEstimate,
      skinImplications: phaseResult.skinImplications,
      cycleLength: latestCycle.cycleLength,
      periodStart: latestCycle.periodStart.toISOString().split("T")[0],
    };
  },
});
