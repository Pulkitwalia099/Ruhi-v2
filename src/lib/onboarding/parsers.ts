const SKIN_TYPE_PATTERNS: Array<{ pattern: RegExp; value: string }> = [
  { pattern: /\b(oily|oil|greasy|tel|chikni|chipchip)\b/i, value: "oily" },
  { pattern: /\b(dry|sukhi|ruk?hi|tight|flaky)\b/i, value: "dry" },
  { pattern: /\b(combin\w*|combo|mixed|dono|both|t-?zone)\b/i, value: "combination" },
  { pattern: /\b(sensitiv\w*|sens|react\w*|irritat\w*|lal|redness)\b/i, value: "sensitive" },
  { pattern: /\b(normal|theek|sahi)\b/i, value: "unknown" },
  { pattern: /\b(not sure|pata nahi|nahi pata|idk|dunno|no idea)\b/i, value: "unknown" },
];

const CONCERN_PATTERNS: Array<{ pattern: RegExp; value: string }> = [
  { pattern: /\b(acne|pimples?|breakouts?|muhase|dane|zits?)\b/i, value: "acne" },
  { pattern: /\b(pigment\w*|dark spots?|daag|dhab\w*|hyperpig\w*|melasma|uneven)\b/i, value: "pigmentation" },
  { pattern: /\b(dull|glow nahi|no glow|lifeless|tired look|radiance)\b/i, value: "dull_skin" },
  { pattern: /\b(dark circles?|aankh|under eye|puffy eye|panda)\b/i, value: "dark_circles" },
  { pattern: /\b(aging|anti.?aging|wrinkles?|fine lines?|old|budh?apa)\b/i, value: "aging" },
  { pattern: /\b(every|sab|overall|general|all|improve)\b/i, value: "overall" },
];

const ROUTINE_PATTERNS: Array<{ pattern: RegExp; value: string }> = [
  { pattern: /\b(full|poori|complete|advanced|sab kuch)\b/i, value: "full" },
  { pattern: /\b(serious|serums?|actives?|intermediate)\b/i, value: "serious" },
  { pattern: /\b(nothing|nahi|none|bilkul nahi|kuch nahi)\b/i, value: "none" },
  { pattern: /\b(basic|simple|cleanser|thoda|kuch|moisturizer|bas lagati)\b/i, value: "basics" },
];

export function parseSkinType(text: string): string | null {
  for (const { pattern, value } of SKIN_TYPE_PATTERNS) {
    if (pattern.test(text)) return value;
  }
  return null;
}

export function parseConcern(text: string): string | null {
  for (const { pattern, value } of CONCERN_PATTERNS) {
    if (pattern.test(text)) return value;
  }
  return null;
}

export function parseRoutine(text: string): string | null {
  for (const { pattern, value } of ROUTINE_PATTERNS) {
    if (pattern.test(text)) return value;
  }
  return null;
}
