import { tool } from "ai";
import { z } from "zod";
import { getRecentScans } from "@/db/queries";

export const getScanHistory = tool({
  description:
    "Get the user's recent face scan history. Call this when the user asks about their past scans, skin progress, or trends over time.",
  inputSchema: z.object({
    userId: z.string().describe("The user's ID"),
    limit: z
      .number()
      .optional()
      .default(5)
      .describe("Number of recent scans to retrieve. Defaults to 5."),
  }),
  execute: async ({ userId, limit }) => {
    const scans = await getRecentScans({ userId, limit });

    if (scans.length === 0) {
      return {
        noScanData: true,
        message:
          "No scan history found. Suggest the user send a selfie for their first face scan.",
      };
    }

    const summaries = scans.map((s) => {
      const results = s.results as Record<string, unknown>;
      return {
        scanId: s.id,
        date: s.createdAt.toISOString().split("T")[0],
        scanType: s.scanType,
        overallScore: (results.overall_score as number) ?? null,
        summary: (results.summary as string) ?? null,
        cycleDay: s.cycleDay,
        cyclePhase: s.cyclePhase,
      };
    });

    return {
      noScanData: false,
      totalScans: scans.length,
      scans: summaries,
    };
  },
});
