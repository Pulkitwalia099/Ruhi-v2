// -----------------------------------------
// src/lib/ai/scan-pipeline.ts
//
// Shared scan pipeline: Gemini Vision analysis,
// DB persistence, and comparison with previous scan.
// Extracted from the Telegram handler so both
// Telegram and Web Chat can reuse the same logic.
// -----------------------------------------

import { generateText, Output } from "ai";
import { z } from "zod";

import { getLanguageModel } from "@/lib/ai/providers";
import { VISION_MODEL } from "@/lib/ai/models";
import { calculateCyclePhase } from "@/lib/ai/tools/cycle-utils";
import { compareScans } from "@/lib/scan/comparator";
import {
  getLatestCycle,
  getRecentScans,
  insertScan,
} from "@/db/queries";

// ---- Scan schema (structured output for Gemini Vision) ----

const zoneSchema = z.object({
  condition: z.string(),
  severity: z.number(),
  clinical_notes: z.string(),
});

export const scanSchema = z.object({
  zones: z.object({
    forehead: zoneSchema,
    t_zone: zoneSchema,
    left_cheek: zoneSchema,
    right_cheek: zoneSchema,
    chin: zoneSchema,
    jawline: zoneSchema,
  }),
  overall_score: z.number(),
  key_concerns: z.array(z.string()),
  positives: z.array(z.string()),
});

export type ScanOutput = z.infer<typeof scanSchema>;

// ---- Pipeline result ----

export interface ScanPipelineResult {
  scanResult: ScanOutput | null;
  comparisonBlock: string;
  cycleContext: string;
}

// ---- Main pipeline function ----

export async function runScanPipeline(options: {
  imageData: string; // base64 string
  userId: string;
  imageUrl: string; // Blob URL after upload
}): Promise<ScanPipelineResult> {
  const { imageData, userId, imageUrl } = options;

  // 1. Get cycle context
  let cycleContext = "";
  let cycleDay: number | undefined;
  let cyclePhase: string | undefined;
  const cycle = await getLatestCycle({ userId });
  if (cycle) {
    const phase = calculateCyclePhase(cycle.periodStart, cycle.cycleLength);
    cycleDay = phase.cycleDay;
    cyclePhase = phase.phase;
    cycleContext = `\nCycle context: Day ${phase.cycleDay}, ${phase.phase} phase. ${phase.skinImplications}`;
  }

  // 2. Get recent scan history
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

  // 3. Call Gemini Vision with structured output
  const scanResult = await generateText({
    model: getLanguageModel(VISION_MODEL),
    output: Output.object({ schema: scanSchema }),
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `You are a clinical dermatology AI. Analyze this selfie objectively across 6 facial zones: forehead, t_zone, left_cheek, right_cheek, chin, jawline.

For each zone provide:
- condition: clinical observation (acne, dryness, oiliness, clear, texture issues, hyperpigmentation, etc.)
- severity: 1-10 where 10 = perfectly healthy skin, 1 = severe concern
- clinical_notes: brief clinical assessment
${cycleContext}${historyContext}

Also provide:
- overall_score: 1-10 (10 = excellent skin health)
- key_concerns: array of top 2-3 issues found
- positives: array of things that look good

Be precise and clinical. No personality or emotion — just facts.`,
          },
          { type: "image", image: imageData },
        ],
      },
    ],
  });

  // 4. Save raw scan to DB
  if (scanResult.output) {
    await insertScan({
      userId,
      imageUrl,
      scanType: "face",
      results: scanResult.output as Record<string, unknown>,
      cycleDay,
      cyclePhase,
    });
  }

  // 5. Compare with previous scan
  let comparisonBlock = "";
  if (scanResult.output && recentScans.length > 0) {
    const previousScan = recentScans[0];
    const comparison = compareScans(
      {
        results: previousScan.results as Record<string, unknown>,
        createdAt: previousScan.createdAt,
      },
      {
        results: scanResult.output as Record<string, unknown>,
        createdAt: new Date(),
      },
    );
    if (comparison) {
      comparisonBlock = `\n\n${comparison.summary}`;
    }
  }

  return {
    scanResult: (scanResult.output as ScanOutput) ?? null,
    comparisonBlock,
    cycleContext,
  };
}
