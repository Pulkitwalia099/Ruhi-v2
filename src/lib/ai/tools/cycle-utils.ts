export interface CyclePhaseResult {
  cycleDay: number;
  phase: "menstrual" | "follicular" | "ovulation" | "luteal";
  ovulationEstimate: number;
  nextPeriodEstimate: string;
  skinImplications: string;
}

export function calculateCyclePhase(
  periodStart: Date,
  cycleLength: number,
  today: Date = new Date(),
): CyclePhaseResult {
  const diffMs = today.getTime() - periodStart.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const cycleDay = (diffDays % cycleLength) + 1;
  const ovulationEstimate = cycleLength - 14;

  // Calculate next period date
  let nextPeriod = new Date(
    periodStart.getTime() + cycleLength * 24 * 60 * 60 * 1000,
  );
  while (nextPeriod <= today) {
    nextPeriod = new Date(
      nextPeriod.getTime() + cycleLength * 24 * 60 * 60 * 1000,
    );
  }
  const nextPeriodEstimate = nextPeriod.toISOString().split("T")[0];

  let phase: CyclePhaseResult["phase"];
  let skinImplications: string;

  if (cycleDay <= 5) {
    phase = "menstrual";
    skinImplications =
      "Day " + cycleDay + " — Menstrual phase. Estrogen + progesterone at lowest. " +
      "Skin: dry, dull, sensitive, inflammation peaks. " +
      "Do: gentle cleanser, rich moisturizer, skip actives, soothing ingredients (aloe, centella). " +
      "Don't: new products, harsh exfoliants, retinol. " +
      "Tip: hot compress for cramps, hydration focus.";
  } else if (cycleDay <= ovulationEstimate - 1) {
    phase = "follicular";
    skinImplications =
      "Day " + cycleDay + " — Follicular phase. Estrogen rising, skin barrier strengthening. " +
      "Skin: clearing up, natural glow returning, barrier strong. " +
      "Do: introduce new products (skin is forgiving now), retinol, AHAs, vitamin C. " +
      "Don't: over-exfoliate (skin is good, don't push it). " +
      "Tip: best time to try that new serum or active ingredient.";
  } else if (cycleDay <= ovulationEstimate + 2) {
    phase = "ovulation";
    skinImplications =
      "Day " + cycleDay + " — Ovulation phase. Peak estrogen = peak skin. " +
      "Skin: plump, hydrated, glowing, pores may look larger. " +
      "Do: maintain routine, light moisturizer, good time for a skin selfie (baseline). " +
      "Don't: heavy products (skin doesn't need them right now). " +
      "Tip: enjoy the glow — low-maintenance days.";
  } else if (cycleDay <= ovulationEstimate + 8) {
    phase = "luteal";
    skinImplications =
      "Day " + cycleDay + " — Early luteal phase. Progesterone rising, oil production increasing. " +
      "Skin: getting oilier, pores enlarging, texture changes starting. " +
      "Do: switch to gel/light moisturizer, oil-control products, niacinamide. " +
      "Don't: heavy creams, occlusive products. " +
      "Tip: start prepping — salicylic acid at night can prevent the breakout wave coming in ~5 days.";
  } else {
    phase = "luteal";
    skinImplications =
      "Day " + cycleDay + " — Late luteal phase. Progesterone dropping, androgens dominating. " +
      "Skin: max sebum, acne flares likely (60-70% of women), especially chin and jawline. " +
      "Do: salicylic acid cleanser at night, non-comedogenic everything, spot treatment ready. " +
      "Don't: pick at breakouts, introduce new actives, stress about it (hormonal = temporary). " +
      "Tip: this is hormonal — it WILL pass in " + (cycleLength - cycleDay + 1) + " days when period starts.";
  }

  return {
    cycleDay,
    phase,
    ovulationEstimate,
    nextPeriodEstimate,
    skinImplications,
  };
}
