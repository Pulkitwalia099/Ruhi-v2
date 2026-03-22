/**
 * Scan Comparator — compares two face scan results and produces
 * a human-readable comparison for Ruhi to interpret.
 *
 * Severity scale: 1 = severe concern, 10 = perfectly healthy
 * So a HIGHER score = improvement, LOWER score = worsening.
 */

const ZONE_NAMES: Record<string, string> = {
  forehead: "Forehead",
  t_zone: "T-zone",
  left_cheek: "Left cheek",
  right_cheek: "Right cheek",
  chin: "Chin",
  jawline: "Jawline",
};

interface ZoneResult {
  condition: string;
  severity: number;
  clinical_notes: string;
}

interface ScanResult {
  zones: Record<string, ZoneResult>;
  overall_score: number;
  key_concerns: string[];
  positives: string[];
}

export interface ZoneComparison {
  zone: string;
  zoneName: string;
  previousSeverity: number;
  currentSeverity: number;
  delta: number; // positive = improved, negative = worsened
  previousCondition: string;
  currentCondition: string;
  trend: "improved" | "worsened" | "stable";
}

export interface ScanComparison {
  daysBetween: number;
  overallPrevious: number;
  overallCurrent: number;
  overallDelta: number;
  overallTrend: "improved" | "worsened" | "stable";
  zones: ZoneComparison[];
  improved: ZoneComparison[];
  worsened: ZoneComparison[];
  stable: ZoneComparison[];
  summary: string; // Pre-formatted text for the LLM prompt
}

/**
 * Compare two scan results and return a structured comparison.
 * Returns null if either scan doesn't have valid zone data.
 */
export function compareScans(
  previous: { results: Record<string, unknown>; createdAt: Date },
  current: { results: Record<string, unknown>; createdAt: Date },
): ScanComparison | null {
  const prev = previous.results as unknown as ScanResult;
  const curr = current.results as unknown as ScanResult;

  if (!prev?.zones || !curr?.zones || !prev?.overall_score || !curr?.overall_score) {
    return null;
  }

  const daysBetween = Math.round(
    (current.createdAt.getTime() - previous.createdAt.getTime()) /
      (1000 * 60 * 60 * 24),
  );

  // Compare each zone
  const zones: ZoneComparison[] = [];
  for (const [zoneKey, zoneName] of Object.entries(ZONE_NAMES)) {
    const prevZone = prev.zones[zoneKey];
    const currZone = curr.zones[zoneKey];
    if (!prevZone || !currZone) continue;

    const delta = currZone.severity - prevZone.severity;
    zones.push({
      zone: zoneKey,
      zoneName,
      previousSeverity: prevZone.severity,
      currentSeverity: currZone.severity,
      delta,
      previousCondition: prevZone.condition,
      currentCondition: currZone.condition,
      trend: delta > 0.5 ? "improved" : delta < -0.5 ? "worsened" : "stable",
    });
  }

  const improved = zones.filter((z) => z.trend === "improved");
  const worsened = zones.filter((z) => z.trend === "worsened");
  const stable = zones.filter((z) => z.trend === "stable");

  const overallDelta = curr.overall_score - prev.overall_score;
  const overallTrend: "improved" | "worsened" | "stable" =
    overallDelta > 0.5 ? "improved" : overallDelta < -0.5 ? "worsened" : "stable";

  // Build summary text for the LLM
  const summary = buildSummary({
    daysBetween,
    overallPrevious: prev.overall_score,
    overallCurrent: curr.overall_score,
    overallDelta,
    overallTrend,
    improved,
    worsened,
    stable,
  });

  return {
    daysBetween,
    overallPrevious: prev.overall_score,
    overallCurrent: curr.overall_score,
    overallDelta,
    overallTrend,
    zones,
    improved,
    worsened,
    stable,
    summary,
  };
}

function buildSummary(data: {
  daysBetween: number;
  overallPrevious: number;
  overallCurrent: number;
  overallDelta: number;
  overallTrend: string;
  improved: ZoneComparison[];
  worsened: ZoneComparison[];
  stable: ZoneComparison[];
}): string {
  const lines: string[] = [];

  lines.push(
    `## Scan Comparison (${data.daysBetween} days since last scan)`,
  );
  lines.push(
    `Overall score: ${data.overallPrevious}/10 → ${data.overallCurrent}/10 (${data.overallDelta > 0 ? "+" : ""}${data.overallDelta.toFixed(1)}, ${data.overallTrend})`,
  );

  if (data.improved.length > 0) {
    lines.push("\n**Improved zones:**");
    for (const z of data.improved) {
      lines.push(
        `- ${z.zoneName}: ${z.previousSeverity} → ${z.currentSeverity} (+${z.delta.toFixed(1)}) — was "${z.previousCondition}", now "${z.currentCondition}"`,
      );
    }
  }

  if (data.worsened.length > 0) {
    lines.push("\n**Worsened zones:**");
    for (const z of data.worsened) {
      lines.push(
        `- ${z.zoneName}: ${z.previousSeverity} → ${z.currentSeverity} (${z.delta.toFixed(1)}) — was "${z.previousCondition}", now "${z.currentCondition}"`,
      );
    }
  }

  if (data.stable.length > 0) {
    lines.push("\n**Stable zones:**");
    for (const z of data.stable) {
      lines.push(`- ${z.zoneName}: ${z.currentSeverity}/10 — "${z.currentCondition}"`);
    }
  }

  lines.push(
    "\nUse this comparison to give specific, encouraging feedback. Celebrate improvements, flag regressions gently, and connect changes to products/routine/cycle if you can from memory.",
  );

  return lines.join("\n");
}
