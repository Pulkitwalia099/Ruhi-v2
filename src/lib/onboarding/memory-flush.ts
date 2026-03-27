import { upsertMemory, insertMemory } from "@/db/queries";
import { SKIN_TYPE_LABELS, ROUTINE_LABELS, CONCERN_LABELS, ALLERGY_LABELS } from "./labels";
import type { OnboardingAnswers } from "@/db/schema";

export async function flushAnswersToMemory(
  userId: string,
  answers: OnboardingAnswers,
  scanResult: { overall_score: number; key_concerns: string[]; positives: string[] },
  source: "telegram" | "instagram" = "telegram",
): Promise<void> {
  try {
    if (answers.name) {
      await upsertMemory({ userId, category: "identity", key: "name", value: answers.name });
    }
    if (answers.skinType) {
      await upsertMemory({
        userId, category: "identity", key: "skin_type",
        value: SKIN_TYPE_LABELS[answers.skinType] ?? answers.skinType,
      });
    }
    if (answers.routine) {
      await upsertMemory({
        userId, category: "preference", key: "routine_level",
        value: ROUTINE_LABELS[answers.routine] ?? answers.routine,
      });
    }
    if (answers.concern) {
      await upsertMemory({
        userId, category: "preference", key: "primary_concern",
        value: CONCERN_LABELS[answers.concern] ?? answers.concern,
      });
    }
    if (answers.allergies && answers.allergies.length > 0) {
      const allergyText = answers.allergies
        .map((a) => ALLERGY_LABELS[a] ?? a)
        .join(", ");
      await upsertMemory({ userId, category: "identity", key: "allergies", value: allergyText });
    }
    // Save scan summary as health memory
    // Note: insertMemory is used here because upsertMemory only supports identity/preference categories.
    // The health category does not support key-based upsert in the current DB schema.
    await insertMemory({
      userId, category: "health",
      value: `Skin scan (${source}): score ${scanResult.overall_score}/10. ` +
        `Concerns: ${scanResult.key_concerns.join(", ")}. ` +
        `Positives: ${scanResult.positives.join(", ")}.`,
      metadata: { source: `${source}_onboarding`, score: scanResult.overall_score },
    });
  } catch (err) {
    console.error("[Onboarding] Memory flush error:", err);
  }
}
