export interface QuickReplyOption {
  label: string;
  value: string;
  emoji?: string;
}

export const INTENT_OPTIONS: QuickReplyOption[] = [
  { label: "Skin Analysis", value: "skin_analysis", emoji: "✨" },
  { label: "Fix an Issue", value: "skin_issue", emoji: "🧴" },
  { label: "Just Chat!", value: "just_chat", emoji: "💬" },
];

export const SKIN_TYPE_OPTIONS: QuickReplyOption[] = [
  { label: "Oily", value: "oily", emoji: "🌊" },
  { label: "Dry", value: "dry", emoji: "🏜️" },
  { label: "Combination", value: "combination", emoji: "🎭" },
  { label: "Sensitive", value: "sensitive", emoji: "🌹" },
  { label: "Pata nahi", value: "unknown", emoji: "🤷" },
];

export const CONCERN_OPTIONS: QuickReplyOption[] = [
  { label: "Acne", value: "acne", emoji: "😤" },
  { label: "Pigmentation", value: "pigmentation", emoji: "🌑" },
  { label: "Dull skin", value: "dull_skin", emoji: "😶" },
  { label: "Dark circles", value: "dark_circles", emoji: "👀" },
  { label: "Overall", value: "overall", emoji: "✨" },
];

export const ROUTINE_OPTIONS: QuickReplyOption[] = [
  { label: "Basics", value: "basics", emoji: "🧴" },
  { label: "Serious", value: "serious", emoji: "✨" },
  { label: "Full set", value: "full", emoji: "💅" },
  { label: "Kuch nahi", value: "none", emoji: "🤷" },
];

export const RECS_OPTIONS: QuickReplyOption[] = [
  { label: "Products batao!", value: "products", emoji: "🧴" },
  { label: "Dono chahiye!", value: "both", emoji: "🌿" },
  { label: "Nahi abhi", value: "skip", emoji: "👋" },
];

/** Format options as inline text for desktop fallback (Quick Replies don't render on desktop). */
export function formatOptionsText(options: QuickReplyOption[]): string {
  return options.map((o) => o.label).join(" / ");
}

/** Convert options to Instagram Quick Reply format. */
export function toQuickReplies(
  options: QuickReplyOption[],
  payloadPrefix: string,
): Array<{ title: string; payload: string }> {
  return options.map((o) => ({
    title: `${o.emoji ?? ""} ${o.label}`.trim().slice(0, 20),
    payload: `${payloadPrefix}_${o.value}`,
  }));
}
