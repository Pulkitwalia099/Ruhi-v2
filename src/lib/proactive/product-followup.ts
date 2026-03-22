import {
  getRecommendationMemories,
  getNudgeCountForReference,
} from "@/db/queries";

export interface ProactiveAction {
  type: "product_followup" | "scan_nudge" | "weather_tip";
  referenceId: string;
  prompt: string; // instruction for LLM to generate the message
}

/**
 * Check if any product follow-ups are due for this user.
 * Day 3: first check-in. Day 5: second (only if no reply to first).
 */
export async function checkProductFollowups(
  userId: string,
): Promise<ProactiveAction[]> {
  const recommendations = await getRecommendationMemories({ userId });
  const actions: ProactiveAction[] = [];

  for (const rec of recommendations) {
    const meta = rec.metadata as Record<string, unknown> | null;
    const recommendedAt = meta?.date
      ? new Date(meta.date as string)
      : rec.createdAt;

    const daysSince = Math.floor(
      (Date.now() - recommendedAt.getTime()) / (1000 * 60 * 60 * 24),
    );

    // Only follow up between day 3-7
    if (daysSince < 3 || daysSince > 7) continue;

    const nudgeCount = await getNudgeCountForReference({
      userId,
      type: "product_followup",
      referenceId: rec.id,
    });

    // Day 3+: first follow-up
    if (daysSince >= 3 && nudgeCount === 0) {
      actions.push({
        type: "product_followup",
        referenceId: rec.id,
        prompt: `Follow up on your recommendation of "${rec.value}" from ${daysSince} days ago. Ask casually if they tried it and how it's going. Keep it to 1-2 sentences.`,
      });
    }
    // Day 5+: second follow-up (only if first was sent but no scan/reply)
    else if (daysSince >= 5 && nudgeCount === 1) {
      actions.push({
        type: "product_followup",
        referenceId: rec.id,
        prompt: `Second follow-up on "${rec.value}" recommended ${daysSince} days ago. They didn't respond to the first check-in. Ask gently if they had a chance to try it, or if they have any concerns. Keep it brief — 1-2 sentences. Don't be pushy.`,
      });
    }
    // nudgeCount >= 2: done, skip
  }

  return actions;
}
