import { describe, it, expect } from "vitest";
import { calculateCyclePhase } from "@/lib/ai/tools/cycle-utils";

describe("calculateCyclePhase", () => {
  // Standard 28-day cycle starting Jan 1, 2025
  const periodStart = new Date("2025-01-01");
  const cycleLength = 28;

  describe("menstrual phase (days 1-5)", () => {
    it("returns menstrual phase on day 1 (period start day)", () => {
      const today = new Date("2025-01-01");
      const result = calculateCyclePhase(periodStart, cycleLength, today);
      expect(result.cycleDay).toBe(1);
      expect(result.phase).toBe("menstrual");
    });

    it("returns menstrual phase on day 5", () => {
      const today = new Date("2025-01-05");
      const result = calculateCyclePhase(periodStart, cycleLength, today);
      expect(result.cycleDay).toBe(5);
      expect(result.phase).toBe("menstrual");
    });

    it("includes skin sensitivity warning during menstrual phase", () => {
      const today = new Date("2025-01-03");
      const result = calculateCyclePhase(periodStart, cycleLength, today);
      expect(result.skinImplications).toContain("sensitive");
      expect(result.skinImplications).toContain("hydration");
    });
  });

  describe("follicular phase (days 6 to ovulation-1)", () => {
    it("returns follicular phase on day 6", () => {
      const today = new Date("2025-01-06");
      const result = calculateCyclePhase(periodStart, cycleLength, today);
      expect(result.cycleDay).toBe(6);
      expect(result.phase).toBe("follicular");
    });

    it("returns follicular phase on day 13 (ovulation-1 for 28-day cycle)", () => {
      const today = new Date("2025-01-13");
      const result = calculateCyclePhase(periodStart, cycleLength, today);
      expect(result.cycleDay).toBe(13);
      expect(result.phase).toBe("follicular");
    });

    it("includes glow-related skin advice during follicular phase", () => {
      const today = new Date("2025-01-08");
      const result = calculateCyclePhase(periodStart, cycleLength, today);
      expect(result.skinImplications).toContain("glow");
    });
  });

  describe("ovulation phase (around day 14 for 28-day cycle)", () => {
    it("returns ovulation phase on estimated ovulation day", () => {
      // For 28-day cycle: ovulation estimate = 28 - 14 = 14
      const today = new Date("2025-01-14");
      const result = calculateCyclePhase(periodStart, cycleLength, today);
      expect(result.cycleDay).toBe(14);
      expect(result.phase).toBe("ovulation");
    });

    it("returns ovulation phase 2 days after estimated ovulation", () => {
      const today = new Date("2025-01-16");
      const result = calculateCyclePhase(periodStart, cycleLength, today);
      expect(result.cycleDay).toBe(16);
      expect(result.phase).toBe("ovulation");
    });

    it("sets correct ovulation estimate for 28-day cycle", () => {
      const today = new Date("2025-01-14");
      const result = calculateCyclePhase(periodStart, cycleLength, today);
      expect(result.ovulationEstimate).toBe(14);
    });
  });

  describe("luteal phase (post-ovulation to cycle end)", () => {
    it("returns luteal phase on day 17 (ovulation+3 for 28-day cycle)", () => {
      const today = new Date("2025-01-17");
      const result = calculateCyclePhase(periodStart, cycleLength, today);
      expect(result.cycleDay).toBe(17);
      expect(result.phase).toBe("luteal");
    });

    it("returns luteal phase on day 28 (last day of cycle)", () => {
      const today = new Date("2025-01-28");
      const result = calculateCyclePhase(periodStart, cycleLength, today);
      expect(result.cycleDay).toBe(28);
      expect(result.phase).toBe("luteal");
    });

    it("includes breakout warning during luteal phase", () => {
      const today = new Date("2025-01-20");
      const result = calculateCyclePhase(periodStart, cycleLength, today);
      expect(result.skinImplications).toContain("breakouts");
      expect(result.skinImplications).toContain("non-comedogenic");
    });
  });

  describe("custom cycle length (35-day cycle)", () => {
    it("calculates correct ovulation estimate for 35-day cycle", () => {
      const today = new Date("2025-01-01");
      const result = calculateCyclePhase(periodStart, 35, today);
      // ovulationEstimate = 35 - 14 = 21
      expect(result.ovulationEstimate).toBe(21);
    });

    it("returns follicular phase on day 15 (still before ovulation in 35-day cycle)", () => {
      const today = new Date("2025-01-15");
      const result = calculateCyclePhase(periodStart, 35, today);
      expect(result.cycleDay).toBe(15);
      expect(result.phase).toBe("follicular");
    });

    it("returns ovulation phase around day 21 for 35-day cycle", () => {
      const today = new Date("2025-01-21");
      const result = calculateCyclePhase(periodStart, 35, today);
      expect(result.cycleDay).toBe(21);
      expect(result.phase).toBe("ovulation");
    });

    it("returns luteal phase on day 25 for 35-day cycle", () => {
      const today = new Date("2025-01-25");
      const result = calculateCyclePhase(periodStart, 35, today);
      expect(result.cycleDay).toBe(25);
      expect(result.phase).toBe("luteal");
    });
  });

  describe("wrapping around when past cycle length", () => {
    it("wraps to day 1 at the start of a new cycle", () => {
      // 28 days after Jan 1 = Jan 29 => new cycle day 1
      const today = new Date("2025-01-29");
      const result = calculateCyclePhase(periodStart, cycleLength, today);
      expect(result.cycleDay).toBe(1);
      expect(result.phase).toBe("menstrual");
    });

    it("wraps correctly two cycles later", () => {
      // 56 days after Jan 1 = Feb 26 => day 1 of 3rd cycle
      const today = new Date("2025-02-26");
      const result = calculateCyclePhase(periodStart, cycleLength, today);
      expect(result.cycleDay).toBe(1);
      expect(result.phase).toBe("menstrual");
    });

    it("calculates next period date correctly when wrapping", () => {
      const today = new Date("2025-02-10");
      const result = calculateCyclePhase(periodStart, cycleLength, today);
      // Jan 1 + 28 = Jan 29, Jan 29 + 28 = Feb 26
      // Feb 10 is before Feb 26, so next period = Feb 26
      expect(result.nextPeriodEstimate).toBe("2025-02-26");
    });
  });

  describe("next period estimate", () => {
    it("calculates next period for first cycle", () => {
      const today = new Date("2025-01-10");
      const result = calculateCyclePhase(periodStart, cycleLength, today);
      expect(result.nextPeriodEstimate).toBe("2025-01-29");
    });

    it("advances next period when current cycle has passed", () => {
      const today = new Date("2025-01-30");
      const result = calculateCyclePhase(periodStart, cycleLength, today);
      // Jan 1 + 28 = Jan 29 (already passed), so next = Jan 29 + 28 = Feb 26
      expect(result.nextPeriodEstimate).toBe("2025-02-26");
    });
  });
});
