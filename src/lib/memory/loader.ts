import { loadMemories } from "@/db/queries";
import type { Memory } from "@/db/schema";

/**
 * Load memories from DB and format into a text block
 * for injection into the system prompt.
 * Returns null if no memories exist for the user.
 */
export async function loadAndFormatMemories(
  userId: string,
): Promise<string | null> {
  const memories = await loadMemories({ userId });

  if (memories.length === 0) return null;

  return formatMemoriesBlock(memories);
}

const MAX_WORDS = 5_000;

function formatMemoriesBlock(memories: Memory[]): string {
  // Group by category
  const grouped: Record<string, Memory[]> = {};
  for (const m of memories) {
    if (!grouped[m.category]) grouped[m.category] = [];
    grouped[m.category].push(m);
  }

  const sections: string[] = [];

  // Identity
  if (grouped.identity) {
    const lines = grouped.identity.map(
      (m) => `- ${formatKey(m.key!)}: ${m.value}`,
    );
    sections.push(`**Identity:**\n${lines.join("\n")}`);
  }

  // Health
  if (grouped.health) {
    const lines = grouped.health.map((m) => {
      const meta = m.metadata as Record<string, unknown> | null;
      const status = meta?.status ? ` [${meta.status}]` : "";
      const date = meta?.date ? ` (${meta.date})` : "";
      return `- ${m.value}${status}${date}`;
    });
    sections.push(`**Health (recent):**\n${lines.join("\n")}`);
  }

  // Preferences
  if (grouped.preference) {
    const lines = grouped.preference.map(
      (m) => `- ${formatKey(m.key!)}: ${m.value}`,
    );
    sections.push(`**Preferences:**\n${lines.join("\n")}`);
  }

  // Context (non-expired, filtered by query)
  if (grouped.context) {
    const lines = grouped.context.map((m) => `- ${m.value}`);
    sections.push(`**What's happening right now:**\n${lines.join("\n")}`);
  }

  // Moments
  if (grouped.moment) {
    const lines = grouped.moment.map((m) => `- ${m.value}`);
    sections.push(`**Recent moments:**\n${lines.join("\n")}`);
  }

  let body = sections.join("\n\n");

  // Safety cap: truncate if too long
  const wordCount = body.split(/\s+/).length;
  if (wordCount > MAX_WORDS) {
    // Trim oldest moments and health entries from the text (not DB)
    // Rebuild with fewer entries
    if (grouped.moment && grouped.moment.length > 10) {
      grouped.moment = grouped.moment.slice(0, 10);
    }
    if (grouped.health && grouped.health.length > 15) {
      grouped.health = grouped.health.slice(0, 15);
    }
    // Rebuild (recursive but capped once)
    return formatMemoriesBlock([
      ...(grouped.identity ?? []),
      ...(grouped.health ?? []),
      ...(grouped.preference ?? []),
      ...(grouped.context ?? []),
      ...(grouped.moment ?? []),
    ]);
  }

  const instructions = `
### How to use these memories
- Reference 1-2 memories per conversation, naturally. "Woh serum kaisa chal raha hai?" — not "On March 15 you started using a niacinamide serum."
- Health and identity references are always welcome — they make advice personal.
- Moments need gentle handling — check in ONCE, don't keep bringing it up.
- Preferences shape your response silently. If budget is "under ₹500", lead with affordable options without saying "I know you're budget-conscious."
- If no memories exist yet, that's fine. Build them as the conversation flows.`;

  return `## What You Remember About This User\n\n${body}\n${instructions}`;
}

/** Convert snake_case key to readable label */
function formatKey(key: string): string {
  return key
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
