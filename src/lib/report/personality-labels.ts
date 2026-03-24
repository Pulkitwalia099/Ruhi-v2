// ------------------------------------------------
// src/lib/report/personality-labels.ts
//
// Maps (score + concern + skin type + routine) to a
// curated personality label for the Skin Profile Card.
// These are fun, shareable, identity-driven labels
// that make the card feel personal.
// ------------------------------------------------

interface LabelInput {
  score: number;
  concern: string;
  skinType: string;
  routineLevel: string;
}

interface PersonalityLabel {
  text: string;
  emoji: string;
}

/** Label pools keyed by vibe */
const LABELS = {
  blessed: [
    { text: "Naturally Blessed", emoji: "👑" },
    { text: "Effortless Glow", emoji: "✨" },
  ],
  glowSeeking: [
    { text: "Main Character Skin", emoji: "💅" },
    { text: "Born to Glow", emoji: "🌟" },
  ],
  acneFighting: [
    { text: "Clear Skin Era", emoji: "✨" },
    { text: "On My Way to Flawless", emoji: "💪" },
  ],
  minimalist: [
    { text: "Skinimalist", emoji: "🧴" },
    { text: "Effortless Beauty", emoji: "🌿" },
  ],
  sensitive: [
    { text: "Soft Girl Skin", emoji: "🌸" },
    { text: "Gentle Glow", emoji: "🦋" },
  ],
  justStarting: [
    { text: "Day One Energy", emoji: "🚀" },
    { text: "Fresh Start, Fresh Face", emoji: "🌱" },
  ],
} as const;

/** Pick one from a pool using score as a simple seed */
function pick(pool: readonly PersonalityLabel[], seed: number): PersonalityLabel {
  return pool[Math.abs(seed) % pool.length];
}

/**
 * Returns a personality label based on the user's scan score,
 * primary concern, skin type, and routine level.
 *
 * Matching priority (first match wins):
 * 1. Score 8+ any → "Naturally Blessed" / "Effortless Glow"
 * 2. Score 7+ glow-seeking concern → "Main Character Skin" / "Born to Glow"
 * 3. Score 5+ acne concern → "Clear Skin Era" / "On My Way to Flawless"
 * 4. Score 5+ minimal routine → "Skinimalist" / "Effortless Beauty"
 * 5. Score 5+ sensitive skin → "Soft Girl Skin" / "Gentle Glow"
 * 6. Fallback (just starting) → "Day One Energy" / "Fresh Start, Fresh Face"
 */
export function getPersonalityLabel({
  score,
  concern,
  skinType,
  routineLevel,
}: LabelInput): PersonalityLabel {
  // 1. High scorers
  if (score >= 8) {
    return pick(LABELS.blessed, score);
  }

  // 2. Glow seekers (score 7+, concerned about dullness or overall improvement)
  const glowConcerns = ["dull_skin", "overall"];
  if (score >= 7 && glowConcerns.includes(concern)) {
    return pick(LABELS.glowSeeking, score);
  }

  // 3. Acne fighters (score 5+)
  if (score >= 5 && concern === "acne") {
    return pick(LABELS.acneFighting, score);
  }

  // 4. Minimalists (score 5+, basic or no routine)
  const minimalRoutines = ["basics", "none"];
  if (score >= 5 && minimalRoutines.includes(routineLevel)) {
    return pick(LABELS.minimalist, score);
  }

  // 5. Sensitive skin (score 5+)
  if (score >= 5 && skinType === "sensitive") {
    return pick(LABELS.sensitive, score);
  }

  // 6. Fallback — just starting or low score
  return pick(LABELS.justStarting, score);
}
