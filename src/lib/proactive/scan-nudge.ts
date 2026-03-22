import { getRecentScans, getScanNudgeCountSince } from "@/db/queries";
import type { ProactiveAction } from "./product-followup";

/**
 * Check if a scan comparison nudge is due.
 * Day 4: first nudge. Day 10: second (only if no new scan since).
 */
export async function checkScanNudge(
  userId: string,
): Promise<ProactiveAction | null> {
  const scans = await getRecentScans({ userId, limit: 1 });

  // Never scanned — don't nudge (they need to discover scanning organically)
  if (scans.length === 0) return null;

  const lastScan = scans[0];
  const daysSince = Math.floor(
    (Date.now() - lastScan.createdAt.getTime()) / (1000 * 60 * 60 * 24),
  );

  // Too early or too old
  if (daysSince < 4 || daysSince > 14) return null;

  const nudgeCount = await getScanNudgeCountSince({
    userId,
    since: lastScan.createdAt,
  });

  // Extract key concerns from last scan for context
  const results = lastScan.results as Record<string, unknown> | null;
  const concerns = (results?.key_concerns as string[]) ?? [];
  const score = results?.overall_score ?? "unknown";
  const concernText = concerns.length > 0
    ? concerns.slice(0, 2).join(" and ")
    : "skin health";

  // Day 4+: first nudge
  if (daysSince >= 4 && nudgeCount === 0) {
    return {
      type: "scan_nudge",
      referenceId: lastScan.id,
      prompt: `User's last skin scan was ${daysSince} days ago. Score was ${score}/10. Key concerns: ${concernText}. Nudge them to send a fresh selfie so you can compare progress. Be casual — 1-2 sentences. Mention what you'd be looking for in the comparison.`,
    };
  }

  // Day 10+: second nudge
  if (daysSince >= 10 && nudgeCount === 1) {
    return {
      type: "scan_nudge",
      referenceId: lastScan.id,
      prompt: `It's been ${daysSince} days since their last skin scan (score ${score}/10, concerns: ${concernText}). This is a gentle second nudge — just mention you'd love to see how things are going. 1-2 sentences, no pressure.`,
    };
  }

  return null;
}
