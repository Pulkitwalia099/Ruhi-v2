import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the DB query functions before importing safety-net
vi.mock("@/db/queries", () => ({
  findMemoryByKey: vi.fn().mockResolvedValue(null),
  upsertMemory: vi.fn().mockResolvedValue(undefined),
  insertMemory: vi.fn().mockResolvedValue(undefined),
}));

import { runPostHocSafetyNet } from "@/lib/memory/safety-net";
import { findMemoryByKey, upsertMemory, insertMemory } from "@/db/queries";

const userId = "test-user-123";

beforeEach(() => {
  vi.clearAllMocks();
  (findMemoryByKey as any).mockResolvedValue(null);
});

describe("runPostHocSafetyNet", () => {
  describe("existing patterns — identity", () => {
    it("catches skin type from English", async () => {
      await runPostHocSafetyNet(userId, "my skin is oily");
      expect(upsertMemory).toHaveBeenCalledWith(
        expect.objectContaining({ category: "identity", key: "skin_type", value: "oily" }),
      );
    });

    it("catches skin type from Hinglish", async () => {
      await runPostHocSafetyNet(userId, "meri skin dry hai");
      expect(upsertMemory).toHaveBeenCalledWith(
        expect.objectContaining({ category: "identity", key: "skin_type", value: "dry" }),
      );
    });

    it("catches name from English", async () => {
      await runPostHocSafetyNet(userId, "my name is Priya");
      expect(upsertMemory).toHaveBeenCalledWith(
        expect.objectContaining({ category: "identity", key: "name", value: "Priya" }),
      );
    });

    it("catches name from Hinglish", async () => {
      await runPostHocSafetyNet(userId, "mera naam Pulkit hai");
      expect(upsertMemory).toHaveBeenCalledWith(
        expect.objectContaining({ category: "identity", key: "name", value: "Pulkit" }),
      );
    });

    it("catches female gender", async () => {
      await runPostHocSafetyNet(userId, "I'm a girl");
      expect(upsertMemory).toHaveBeenCalledWith(
        expect.objectContaining({ category: "identity", key: "gender", value: "female" }),
      );
    });

    it("catches male gender", async () => {
      await runPostHocSafetyNet(userId, "main ladka hoon");
      expect(upsertMemory).toHaveBeenCalledWith(
        expect.objectContaining({ category: "identity", key: "gender", value: "male" }),
      );
    });

    it("skips skin type if already exists", async () => {
      (findMemoryByKey as any).mockResolvedValue({ id: "existing", value: "oily" });
      await runPostHocSafetyNet(userId, "my skin is dry");
      // upsertMemory should NOT be called for skin_type (findMemoryByKey returned existing)
      const skinTypeCalls = (upsertMemory as any).mock.calls.filter(
        (call: any[]) => call[0]?.key === "skin_type",
      );
      expect(skinTypeCalls).toHaveLength(0);
    });
  });

  describe("new patterns — budget", () => {
    it("catches explicit budget mention", async () => {
      await runPostHocSafetyNet(userId, "mera budget tight hai");
      expect(upsertMemory).toHaveBeenCalledWith(
        expect.objectContaining({ category: "preference", key: "budget" }),
      );
    });

    it("catches numeric budget", async () => {
      await runPostHocSafetyNet(userId, "500 mein chahiye kuch");
      expect(upsertMemory).toHaveBeenCalledWith(
        expect.objectContaining({ category: "preference", key: "budget", value: "around 500" }),
      );
    });

    it("catches 'sasta chahiye'", async () => {
      await runPostHocSafetyNet(userId, "sasta chahiye yaar");
      expect(upsertMemory).toHaveBeenCalledWith(
        expect.objectContaining({ category: "preference", key: "budget", value: "budget-conscious" }),
      );
    });

    it("catches 'paise nahi'", async () => {
      await runPostHocSafetyNet(userId, "paise nahi hain abhi");
      expect(upsertMemory).toHaveBeenCalledWith(
        expect.objectContaining({ category: "preference", key: "budget", value: "budget-conscious" }),
      );
    });

    it("does NOT trigger on bare word 'budget' without context", async () => {
      await runPostHocSafetyNet(userId, "what's a good budget sunscreen?");
      const budgetCalls = (upsertMemory as any).mock.calls.filter(
        (call: any[]) => call[0]?.key === "budget",
      );
      expect(budgetCalls).toHaveLength(0);
    });

    it("does NOT trigger on bare word 'flexible'", async () => {
      await runPostHocSafetyNet(userId, "it has flexible texture");
      const budgetCalls = (upsertMemory as any).mock.calls.filter(
        (call: any[]) => call[0]?.key === "budget",
      );
      expect(budgetCalls).toHaveLength(0);
    });

    it("skips budget if already saved", async () => {
      (findMemoryByKey as any).mockResolvedValue({ id: "existing", value: "flexible" });
      await runPostHocSafetyNet(userId, "mera budget tight hai");
      const budgetCalls = (upsertMemory as any).mock.calls.filter(
        (call: any[]) => call[0]?.key === "budget",
      );
      expect(budgetCalls).toHaveLength(0);
    });
  });

  describe("new patterns — advice style", () => {
    it("catches 'itne saare questions'", async () => {
      await runPostHocSafetyNet(userId, "itne saare questions mat poocho");
      expect(upsertMemory).toHaveBeenCalledWith(
        expect.objectContaining({
          category: "preference",
          key: "advice_style",
          value: "prefers concise, fewer questions",
        }),
      );
    });

    it("catches 'too many questions'", async () => {
      await runPostHocSafetyNet(userId, "too many questions at once");
      expect(upsertMemory).toHaveBeenCalledWith(
        expect.objectContaining({ category: "preference", key: "advice_style" }),
      );
    });

    it("catches 'stop asking'", async () => {
      await runPostHocSafetyNet(userId, "stop asking so many things");
      expect(upsertMemory).toHaveBeenCalledWith(
        expect.objectContaining({ category: "preference", key: "advice_style" }),
      );
    });

    it("catches 'short mein batao'", async () => {
      await runPostHocSafetyNet(userId, "short mein batao yaar");
      expect(upsertMemory).toHaveBeenCalledWith(
        expect.objectContaining({ category: "preference", key: "advice_style" }),
      );
    });

    it("catches 'ek baar mein'", async () => {
      await runPostHocSafetyNet(userId, "itne qs ek baar mein?!");
      expect(upsertMemory).toHaveBeenCalledWith(
        expect.objectContaining({ category: "preference", key: "advice_style" }),
      );
    });
  });

  describe("new patterns — remedy preference", () => {
    it("catches 'gharelu nahi'", async () => {
      await runPostHocSafetyNet(userId, "gharelu nuskhe nahi chahiye yaar");
      expect(upsertMemory).toHaveBeenCalledWith(
        expect.objectContaining({
          category: "preference",
          key: "remedies",
          value: "not interested",
        }),
      );
    });

    it("catches 'home remedy nahi'", async () => {
      await runPostHocSafetyNet(userId, "home remedy nahi please");
      expect(upsertMemory).toHaveBeenCalledWith(
        expect.objectContaining({ category: "preference", key: "remedies" }),
      );
    });

    it("does NOT trigger on positive home remedy mention", async () => {
      await runPostHocSafetyNet(userId, "gharelu nuskhe batao");
      const remedyCalls = (upsertMemory as any).mock.calls.filter(
        (call: any[]) => call[0]?.key === "remedies",
      );
      expect(remedyCalls).toHaveLength(0);
    });
  });

  describe("safety — never throws", () => {
    it("swallows errors gracefully", async () => {
      (findMemoryByKey as any).mockRejectedValue(new Error("DB down"));
      // Should not throw
      await expect(
        runPostHocSafetyNet(userId, "my name is Test"),
      ).resolves.toBeUndefined();
    });

    it("does nothing on empty text", async () => {
      await runPostHocSafetyNet(userId, "");
      expect(upsertMemory).not.toHaveBeenCalled();
      expect(insertMemory).not.toHaveBeenCalled();
    });

    it("does nothing on greetings", async () => {
      await runPostHocSafetyNet(userId, "hey whats up");
      expect(upsertMemory).not.toHaveBeenCalled();
      expect(insertMemory).not.toHaveBeenCalled();
    });
  });
});
