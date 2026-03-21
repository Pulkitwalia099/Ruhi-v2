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
      "Skin may be more sensitive and dull. Estrogen and progesterone are at their lowest. Focus on gentle hydration and avoid harsh exfoliants.";
  } else if (cycleDay <= ovulationEstimate - 1) {
    phase = "follicular";
    skinImplications =
      "Skin is at its best — estrogen rising gives a natural glow. Good time for active ingredients like retinol or AHAs.";
  } else if (cycleDay <= ovulationEstimate + 2) {
    phase = "ovulation";
    skinImplications =
      "Peak estrogen = peak glow, but pores may appear larger. Oil production starting to increase. Light moisturizer recommended.";
  } else {
    phase = "luteal";
    skinImplications =
      "Progesterone peaks, increased sebum production. Higher chance of hormonal breakouts especially on chin and jawline. Use non-comedogenic products.";
  }

  return {
    cycleDay,
    phase,
    ovulationEstimate,
    nextPeriodEstimate,
    skinImplications,
  };
}
