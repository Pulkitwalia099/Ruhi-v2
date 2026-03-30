import {
  getAllProactiveEligibleUsers,
  getUserLastMessageTime,
  getProactiveCountSince,
  findMemoryByKey,
} from "@/db/queries";
import { checkProductFollowups } from "./product-followup";
import { checkScanNudge } from "./scan-nudge";
import { checkWeatherTip } from "./weather-tip";
import { generateAndSend } from "./sender";
import type { ProactiveAction } from "./product-followup";

const QUIET_HOURS_START = 9; // 9 AM IST
const QUIET_HOURS_END = 21; // 9 PM IST
const INACTIVITY_THRESHOLD_MS = 48 * 60 * 60 * 1000; // 48 hours
const FREQUENCY_CAP_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Main orchestrator for proactive messaging.
 * Called by the hourly cron job.
 * Returns the total number of messages sent.
 */
export async function runProactiveChecks(): Promise<number> {
  // On Hobby plan, cron runs once daily at 9 AM IST (3:30 AM UTC).
  // Quiet hours check kept as safety guard in case schedule changes.
  const nowUtc = new Date();
  const istHour = (nowUtc.getUTCHours() + 5 + (nowUtc.getUTCMinutes() >= 30 ? 1 : 0)) % 24;

  if (istHour < QUIET_HOURS_START || istHour >= QUIET_HOURS_END) {
    console.log(`[Proactive] Quiet hours (IST ${istHour}:xx). Skipping.`);
    return 0;
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    console.error("[Proactive] TELEGRAM_BOT_TOKEN not set");
    return 0;
  }

  const users = await getAllProactiveEligibleUsers();
  console.log(`[Proactive] Checking ${users.length} eligible users`);

  let totalSent = 0;

  for (const user of users) {
    try {
      const sent = await processUser(user.id, Number(user.telegramId), botToken);
      totalSent += sent;
    } catch (error) {
      console.error(`[Proactive] Error for user ${user.id}:`, error);
    }
  }

  return totalSent;
}

async function processUser(
  userId: string,
  telegramChatId: number,
  botToken: string,
): Promise<number> {
  // Respect opt-out preference
  const optedOut = await findMemoryByKey({ userId, category: "preference", key: "opted_out" });
  if (optedOut?.value === "true") {
    return 0;
  }

  // Check activity status
  const lastMessageTime = await getUserLastMessageTime({ userId });
  const isInactive = !lastMessageTime ||
    Date.now() - lastMessageTime.getTime() > INACTIVITY_THRESHOLD_MS;

  // If inactive, check frequency cap (max 1 per 24h)
  if (isInactive) {
    const recentCount = await getProactiveCountSince({
      userId,
      since: new Date(Date.now() - FREQUENCY_CAP_MS),
    });
    if (recentCount > 0) {
      return 0; // Already sent one in last 24h, skip
    }
  }

  // Collect all due actions (priority order)
  const actions: ProactiveAction[] = [];

  // Priority 1: Product follow-ups
  const productActions = await checkProductFollowups(userId);
  actions.push(...productActions);

  // Priority 2: Scan nudge
  const scanAction = await checkScanNudge(userId);
  if (scanAction) actions.push(scanAction);

  // Priority 3: Weather tip
  const weatherAction = await checkWeatherTip(userId);
  if (weatherAction) actions.push(weatherAction);

  if (actions.length === 0) return 0;

  // If inactive: send only the highest priority action
  // If active: send all due actions
  const toSend = isInactive ? [actions[0]] : actions;
  let sent = 0;

  for (const action of toSend) {
    const success = await generateAndSend({
      userId,
      telegramChatId,
      action,
      botToken,
    });
    if (success) sent++;
  }

  return sent;
}
