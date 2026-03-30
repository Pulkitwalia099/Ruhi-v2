import { describe, it, expect, vi } from "vitest";

// Mock server-only and env-dependent modules before any imports
vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({ env: {} }));
vi.mock("@/db/queries", () => ({}));
vi.mock("@/lib/memory/loader", () => ({ loadAndFormatMemories: vi.fn() }));
vi.mock("@vercel/blob", () => ({ put: vi.fn() }));

import { parseSkinType, parseConcern, parseRoutine } from "@/lib/onboarding/parsers";
import {
  formatOptionsText,
  toQuickReplies,
  SKIN_TYPE_OPTIONS,
  CONCERN_OPTIONS,
  ROUTINE_OPTIONS,
  RECS_OPTIONS,
} from "@/lib/onboarding/questions";
import {
  generateFirstImpression,
  generateFriendshipOpener,
} from "@/lib/instagram/onboarding";

// ---- Parsers ----

describe("parseSkinType", () => {
  it("matches English skin types", () => {
    expect(parseSkinType("my skin is oily")).toBe("oily");
    expect(parseSkinType("I have dry skin")).toBe("dry");
    expect(parseSkinType("it's combination")).toBe("combination");
    expect(parseSkinType("very sensitive")).toBe("sensitive");
  });

  it("matches word variants (plurals, suffixes)", () => {
    expect(parseSkinType("combo skin")).toBe("combination");
    expect(parseSkinType("combined type")).toBe("combination");
    expect(parseSkinType("skin irritation")).toBe("sensitive");
    expect(parseSkinType("it reacts to everything")).toBe("sensitive");
  });

  it("matches Hindi/Hinglish skin types", () => {
    expect(parseSkinType("bahut tel aata hai")).toBe("oily");
    expect(parseSkinType("skin sukhi rehti hai")).toBe("dry");
    expect(parseSkinType("chikni ho jaati hai")).toBe("oily");
    expect(parseSkinType("pata nahi mujhe")).toBe("unknown");
    expect(parseSkinType("nahi pata")).toBe("unknown");
  });

  it("returns null for unrecognized input", () => {
    expect(parseSkinType("hello")).toBeNull();
    expect(parseSkinType("")).toBeNull();
    expect(parseSkinType("kuch aur baat karo")).toBeNull();
  });

  it("is case-insensitive", () => {
    expect(parseSkinType("OILY")).toBe("oily");
    expect(parseSkinType("Dry")).toBe("dry");
    expect(parseSkinType("Pata Nahi")).toBe("unknown");
  });

  it("matches keywords in longer text", () => {
    expect(parseSkinType("meri skin greasy type hai")).toBe("oily");
    expect(parseSkinType("it gets tight after washing")).toBe("dry");
    expect(parseSkinType("t-zone oily, cheeks dry")).toBe("oily"); // oily matches first
  });
});

describe("parseConcern", () => {
  it("matches English concerns", () => {
    expect(parseConcern("I have acne")).toBe("acne");
    expect(parseConcern("dark spots on my face")).toBe("pigmentation");
    expect(parseConcern("my skin looks dull")).toBe("dull_skin");
    expect(parseConcern("dark circles under eyes")).toBe("dark_circles");
    expect(parseConcern("overall improve karna hai")).toBe("overall");
  });

  it("matches plurals and word variants", () => {
    expect(parseConcern("pimples on forehead")).toBe("acne");
    expect(parseConcern("breakouts every month")).toBe("acne");
    expect(parseConcern("zits on chin")).toBe("acne");
    expect(parseConcern("dark circle under eye")).toBe("dark_circles");
    expect(parseConcern("pigmentation issues")).toBe("pigmentation");
    expect(parseConcern("hyperpigmentation")).toBe("pigmentation");
  });

  it("matches Hindi/Hinglish concerns", () => {
    expect(parseConcern("muhase aa rahe hain")).toBe("acne");
    expect(parseConcern("daag hai face pe")).toBe("pigmentation");
    expect(parseConcern("glow nahi aata")).toBe("dull_skin");
    expect(parseConcern("aankh ke neeche dark hai")).toBe("dark_circles");
    expect(parseConcern("sab theek karna hai")).toBe("overall");
  });

  it("matches medical terms", () => {
    expect(parseConcern("melasma on cheeks")).toBe("pigmentation");
    expect(parseConcern("uneven skin tone")).toBe("pigmentation");
    expect(parseConcern("breakout season")).toBe("acne");
  });

  it("returns null for unrecognized input", () => {
    expect(parseConcern("hello")).toBeNull();
    expect(parseConcern("")).toBeNull();
  });
});

describe("parseRoutine", () => {
  it("matches routine levels", () => {
    expect(parseRoutine("just basic stuff")).toBe("basics");
    expect(parseRoutine("I use serums too")).toBe("serious");
    expect(parseRoutine("full set hai mera")).toBe("full");
    expect(parseRoutine("nothing at all")).toBe("none");
  });

  it("matches plurals and variants", () => {
    expect(parseRoutine("I use a serum")).toBe("serious");
    expect(parseRoutine("serums and actives")).toBe("serious");
    expect(parseRoutine("using actives regularly")).toBe("serious");
  });

  it("matches Hindi routine descriptions", () => {
    expect(parseRoutine("thoda bahut lagati hoon")).toBe("basics");
    expect(parseRoutine("poori routine hai")).toBe("full");
    expect(parseRoutine("bilkul nahi")).toBe("none");
  });

  it("correctly handles 'kuch nahi' as none (not basics)", () => {
    expect(parseRoutine("kuch nahi karti")).toBe("none");
    expect(parseRoutine("kuch nahi lagati")).toBe("none");
  });

  it("matches bare 'kuch' as basics when not followed by nahi", () => {
    expect(parseRoutine("kuch lagati hoon")).toBe("basics");
  });

  it("returns null for unrecognized input", () => {
    expect(parseRoutine("hello")).toBeNull();
    expect(parseRoutine("")).toBeNull();
  });
});

// ---- Question helpers ----

describe("formatOptionsText", () => {
  it("joins option labels with slashes", () => {
    expect(formatOptionsText(SKIN_TYPE_OPTIONS)).toBe(
      "Oily / Dry / Combination / Sensitive / Pata nahi",
    );
  });

  it("works with all option sets", () => {
    expect(formatOptionsText(CONCERN_OPTIONS)).toContain("Acne");
    expect(formatOptionsText(ROUTINE_OPTIONS)).toContain("Basics");
    expect(formatOptionsText(RECS_OPTIONS)).toContain("Products batao!");
  });
});

describe("toQuickReplies", () => {
  it("generates correct payload format", () => {
    const replies = toQuickReplies(SKIN_TYPE_OPTIONS, "TYPE");
    expect(replies).toHaveLength(5);
    expect(replies[0]).toEqual({ title: "🌊 Oily", payload: "TYPE_oily" });
    expect(replies[4]).toEqual({ title: "🤷 Pata nahi", payload: "TYPE_unknown" });
  });

  it("truncates titles to 20 characters", () => {
    const replies = toQuickReplies(CONCERN_OPTIONS, "CONCERN");
    for (const reply of replies) {
      expect(reply.title.length).toBeLessThanOrEqual(20);
    }
  });

  it("uses correct prefix for each option set", () => {
    const recsReplies = toQuickReplies(RECS_OPTIONS, "RECS");
    expect(recsReplies[0].payload).toBe("RECS_products");
    expect(recsReplies[2].payload).toBe("RECS_skip");
  });
});

// ---- First impression generator ----

describe("generateFirstImpression", () => {
  it("returns excited message for high score (>=8)", () => {
    const result = generateFirstImpression({
      overall_score: 9,
      positives: ["Great hydration"],
      key_concerns: ["Minor redness"],
    } as any);
    expect(result).toContain("glow");
    expect(result).toContain("Great hydration");
  });

  it("returns balanced message for mid score (5-7)", () => {
    const result = generateFirstImpression({
      overall_score: 6,
      positives: ["Even tone"],
      key_concerns: ["Some dryness"],
    } as any);
    expect(result).toContain("even tone");
    expect(result).toContain("Some dryness");
  });

  it("returns encouraging message for low score (<5)", () => {
    const result = generateFirstImpression({
      overall_score: 3,
      positives: ["Good elasticity"],
      key_concerns: ["Severe acne"],
    } as any);
    expect(result).toContain("severe acne");
    expect(result).toContain("good elasticity");
    expect(result).toContain("Chalo"); // tum-form!
  });

  it("uses fallback text when arrays are empty", () => {
    const result = generateFirstImpression({
      overall_score: 9,
      positives: [],
      key_concerns: [],
    } as any);
    expect(result).toContain("healthy-looking");
  });

  it("handles missing arrays gracefully", () => {
    const result = generateFirstImpression({
      overall_score: 4,
    } as any);
    expect(result).toBeDefined();
    expect(result.length).toBeGreaterThan(0);
  });
});

// ---- Friendship opener ----

describe("generateFriendshipOpener", () => {
  it("returns acne-specific opener", () => {
    expect(generateFriendshipOpener("acne")).toContain("acne");
  });

  it("returns pigmentation-specific opener", () => {
    expect(generateFriendshipOpener("pigmentation")).toContain("Niacinamide");
  });

  it("returns dull skin opener", () => {
    expect(generateFriendshipOpener("dull_skin")).toContain("ice cube");
  });

  it("returns dark circles opener", () => {
    expect(generateFriendshipOpener("dark_circles")).toContain("Dark circles");
  });

  it("falls back to generic for unknown concern", () => {
    const result = generateFriendshipOpener("something_random");
    expect(result).toContain("Photo bhejo");
  });

  it("falls back to generic for 'overall'", () => {
    const result = generateFriendshipOpener("overall");
    expect(result).toContain("Photo bhejo");
  });
});
