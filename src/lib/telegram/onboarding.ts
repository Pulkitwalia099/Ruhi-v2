import { put } from "@vercel/blob";
import { generateText } from "ai";

import { runScanPipeline } from "@/lib/ai/scan-pipeline";
import { loadAndFormatMemories } from "@/lib/memory/loader";
import {
  getOnboarding,
  upsertOnboarding,
  updateOnboardingState,
  getMemoriesByUserAndCategory,
} from "@/db/queries";
import type { OnboardingAnswers } from "@/db/schema";
import type { TelegramClient } from "./client";
import { SKIN_TYPE_LABELS, ROUTINE_LABELS, CONCERN_LABELS, ALLERGY_LABELS } from "@/lib/onboarding/labels";
import { flushAnswersToMemory } from "@/lib/onboarding/memory-flush";

// ------------------------------------------------
// src/lib/telegram/onboarding.ts
//
// State machine controller for Noor's Telegram
// onboarding flow. Each step collects one piece of
// info via inline keyboard taps or text input, then
// advances to the next state.
// ------------------------------------------------

/** Input from the Telegram handler — either a callback tap, text message, or /start trigger */
export type OnboardingInput =
  | { type: "start" }
  | { type: "callback"; data: string; messageId?: number }
  | { type: "message"; text: string; photo?: { fileId: string } };

/** Onboarding row shape from the DB (answers is `unknown` from jsonb) */
export interface OnboardingRow {
  state: string;
  answers: unknown;
}

// ---- Inline keyboard definitions ----

const INTENT_KEYBOARD = [
  [{ text: "✨ Personalized skin analysis", callback_data: "ob_intent:skin_analysis" }],
  [{ text: "🧴 Kuch skin issue help chahiye", callback_data: "ob_intent:skin_issue" }],
  [{ text: "💬 Baat karni hai!", callback_data: "ob_intent:just_chat" }],
];

const LETSGO_KEYBOARD = [
  [{ text: "Chalo! 🙌", callback_data: "ob_letsgo:yes" }],
];

const SKIN_TYPE_KEYBOARD = [
  [{ text: "🌊 Oily", callback_data: "ob_skin:oily" }],
  [{ text: "🏜️ Dry", callback_data: "ob_skin:dry" }],
  [{ text: "🎭 Combination", callback_data: "ob_skin:combination" }],
  [{ text: "🌹 Sensitive", callback_data: "ob_skin:sensitive" }],
  [{ text: "🤷‍♀️ Pata nahi", callback_data: "ob_skin:unknown" }],
];

const ROUTINE_KEYBOARD = [
  [{ text: "🧴 Basics — cleanser, moisturizer, sunscreen", callback_data: "ob_routine:basics" }],
  [{ text: "✨ Thoda serious — basics + serums/actives", callback_data: "ob_routine:serious" }],
  [{ text: "💅 Full set hai mera", callback_data: "ob_routine:full" }],
  [{ text: "🤷‍♀️ Kuch khaas nahi", callback_data: "ob_routine:none" }],
];

const CONCERN_KEYBOARD = [
  [{ text: "😤 Acne / breakouts", callback_data: "ob_concern:acne" }],
  [{ text: "🌑 Pigmentation / dark spots", callback_data: "ob_concern:pigmentation" }],
  [{ text: "😶‍🌫️ Dull skin / no glow", callback_data: "ob_concern:dull_skin" }],
  [{ text: "👀 Dark circles", callback_data: "ob_concern:dark_circles" }],
  [{ text: "✨ Bas overall improve karna hai", callback_data: "ob_concern:overall" }],
];

const ALLERGY_KEYBOARD = [
  [{ text: "✅ Nope, all good", callback_data: "ob_allergy:none" }],
  [{ text: "🌸 Fragrance is an issue", callback_data: "ob_allergy:fragrance" }],
  [{ text: "🧪 Kuch specific ingredients se", callback_data: "ob_allergy:ingredients" }],
  [{ text: "💍 Metals se (jewellery etc.)", callback_data: "ob_allergy:metals" }],
  [{ text: "🤔 Sure nahi hoon", callback_data: "ob_allergy:unsure" }],
  [{ text: "✅ Done — aage chalo", callback_data: "ob_allergy:done" }],
];

// ---- Main handler ----

/**
 * Handles a single onboarding step. Given the user's current state and
 * their input, validates it, saves the answer, advances state, and sends
 * the next question.
 */
export async function handleOnboardingStep(
  tg: TelegramClient,
  chatId: number,
  userId: string,
  row: OnboardingRow,
  input: OnboardingInput,
): Promise<void> {
  const answers = (row.answers && typeof row.answers === "object" ? row.answers : {}) as OnboardingAnswers;
  const state = row.state;

  try {
  // C3: Escape hatch — let users bail out of onboarding at any point
  if (input.type === "message" && input.text) {
    const SKIP_PATTERNS = /\b(skip|chhodo|rehne do|bas baat karo|no selfie|nahi bhejungi|just chat)\b/i;
    if (SKIP_PATTERNS.test(input.text) && state !== "awaiting_intent") {
      await updateOnboardingState({ userId, state: "skipped", answers });
      await tg.sendMessage(chatId,
        "No worries! Jab mann kare tab bhej dena 💕 Batao kya baat karni hai?");
      return;
    }
  }

  switch (state) {
    // ---- Step 1: Intent ----
    case "awaiting_intent": {
      if (input.type === "start") {
        await tg.sendMessageWithKeyboard(
          chatId,
          "Heyy! 💕 Main Noor hoon — tumhari skincare bestie.\n\nBatao, what's on your mind?",
          INTENT_KEYBOARD,
        );
        return;
      }
      if (input.type === "callback") {
        const intent = input.data.replace("ob_intent:", "");
        if (intent === "just_chat") {
          await updateOnboardingState({ userId, state: "skipped", answers });
          await tg.sendMessage(chatId, "Cool! Jab chaaho baat karo 💬\n\nSkin analysis chahiye ho toh bas bol dena!");
          return;
        }
        // Both "skin_analysis" and "skin_issue" proceed
        const msg = intent === "skin_issue"
          ? "Okay let's start with a quick skin analysis — tumhe better samajh paungi and help bhi better kar paungi 💕"
          : "Nice! Tumhe better samajhne ke liye kuch quick cheezein pooch lungi — taaki jo bataun wo actually kaam aaye. Chalo?";
        await tg.sendMessageWithKeyboard(chatId, msg, LETSGO_KEYBOARD);
        await updateOnboardingState({ userId, state: "awaiting_letsgo", answers });
        return;
      }
      return;
    }

    // ---- Step 2: Let's go confirmation ----
    case "awaiting_letsgo": {
      if (input.type === "callback" && input.data === "ob_letsgo:yes") {
        // Smart skip: check if we already have name in memory
        const nextState = await smartSkipTo("awaiting_name", userId, answers);
        await sendQuestionForState(tg, chatId, nextState.state, nextState.answers);
        await updateOnboardingState({ userId, state: nextState.state, answers: nextState.answers });
        return;
      }
      return;
    }

    // ---- Step 3: Name (text input) ----
    case "awaiting_name": {
      if (input.type === "message" && input.text.trim()) {
        // Sanitize: strip markdown, limit length
        const rawName = input.text.trim().replace(/[*_`\[\]~>]/g, "");
        const name = rawName.substring(0, 50);
        const updated = { ...answers, name };
        const nextState = await smartSkipTo("awaiting_skin_type", userId, updated);
        await sendQuestionForState(tg, chatId, nextState.state, nextState.answers);
        await updateOnboardingState({ userId, state: nextState.state, answers: nextState.answers });
        return;
      }
      // If they tapped something instead of typing, re-ask
      await tg.sendMessage(chatId, "Type karke batao — what should I call you? 😊");
      return;
    }

    // ---- Step 4: Skin type (tap) ----
    case "awaiting_skin_type": {
      if (input.type === "callback" && input.data.startsWith("ob_skin:")) {
        const skinType = input.data.replace("ob_skin:", "");
        const updated = { ...answers, skinType };
        const nextState = await smartSkipTo("awaiting_routine", userId, updated);
        await sendQuestionForState(tg, chatId, nextState.state, nextState.answers);
        await updateOnboardingState({ userId, state: nextState.state, answers: nextState.answers });
        return;
      }
      return;
    }

    // ---- Step 5: Routine level (tap) ----
    case "awaiting_routine": {
      if (input.type === "callback" && input.data.startsWith("ob_routine:")) {
        const routine = input.data.replace("ob_routine:", "");
        const updated = { ...answers, routine };
        const nextState = await smartSkipTo("awaiting_concern", userId, updated);
        await sendQuestionForState(tg, chatId, nextState.state, nextState.answers);
        await updateOnboardingState({ userId, state: nextState.state, answers: nextState.answers });
        return;
      }
      return;
    }

    // ---- Step 6: Main concern (tap) ----
    case "awaiting_concern": {
      if (input.type === "callback" && input.data.startsWith("ob_concern:")) {
        const concern = input.data.replace("ob_concern:", "");
        const updated = { ...answers, concern };
        const nextState = await smartSkipTo("awaiting_allergies", userId, updated);
        await sendQuestionForState(tg, chatId, nextState.state, nextState.answers);
        await updateOnboardingState({ userId, state: nextState.state, answers: nextState.answers });
        return;
      }
      return;
    }

    // ---- Step 7: Allergies (multi-select via toggle) ----
    case "awaiting_allergies": {
      if (input.type === "callback" && input.data.startsWith("ob_allergy:")) {
        const selection = input.data.replace("ob_allergy:", "");

        // "done" finalizes selection and moves on
        if (selection === "done") {
          const finalAllergies = answers.allergies?.length ? answers.allergies : ["none"];
          const updated = { ...answers, allergies: finalAllergies };
          await sendQuestionForState(tg, chatId, "awaiting_selfie", updated);
          await updateOnboardingState({ userId, state: "awaiting_selfie", answers: updated });
          return;
        }

        // "none" clears all and moves on immediately
        if (selection === "none") {
          const updated = { ...answers, allergies: ["none"] };
          await sendQuestionForState(tg, chatId, "awaiting_selfie", updated);
          await updateOnboardingState({ userId, state: "awaiting_selfie", answers: updated });
          return;
        }

        // Toggle the selection
        const current = (answers.allergies ?? []).filter((a) => a !== "none");
        const idx = current.indexOf(selection);
        if (idx >= 0) {
          current.splice(idx, 1);
        } else {
          current.push(selection);
        }
        const updated = { ...answers, allergies: current };
        await updateOnboardingState({ userId, state: "awaiting_allergies", answers: updated });

        // Re-send keyboard with updated selections
        const keyboard = ALLERGY_KEYBOARD.map((row) =>
          row.map((btn) => {
            const val = btn.callback_data.replace("ob_allergy:", "");
            const isSelected = current.includes(val);
            return {
              text: isSelected ? `${btn.text} ✓` : btn.text,
              callback_data: btn.callback_data,
            };
          }),
        );
        await tg.sendMessageWithKeyboard(
          chatId,
          `Selected: ${current.map((a) => ALLERGY_LABELS[a] ?? a).join(", ") || "None yet"}\n\nAur kuch? Tap to toggle, then "Done" when ready.`,
          keyboard,
        );
        return;
      }
      return;
    }

    // ---- Step 8-11: Selfie → Analysis → Card ----
    case "awaiting_selfie": {
      if (input.type === "message" && input.photo) {
        await handleSelfieStep(tg, chatId, userId, answers, input.photo.fileId);
        return;
      }
      // User sent text instead of photo
      if (input.type === "message") {
        await tg.sendMessage(chatId, "Photo bhejo na! 📸 Close-up selfie, natural light, no filter.");
        return;
      }
      return;
    }

    case "generating_profile": {
      // C1: If stuck in generating state for >90s, it crashed. Let user retry.
      if (input.type === "message") {
        const updatedAt = (row as any).updatedAt;
        if (updatedAt) {
          const staleMs = Date.now() - new Date(updatedAt).getTime();
          if (staleMs > 90_000) {
            await updateOnboardingState({ userId, state: "awaiting_selfie", answers });
            await tg.sendMessage(chatId,
              "Sorry yaar, pichli baar kuch issue ho gaya. Ek aur selfie bhej do? 📸");
            return;
          }
        }
        // If <90s, likely still generating — ignore silently
      }
      return;
    }

    default:
      return;
  }
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("[Onboarding] Step error:", state, errMsg);
    try {
      await tg.sendMessage(chatId, "Sorry yaar, kuch problem ho gayi. Dobara try karo? 🙏");
    } catch {
      console.error("[Onboarding] Failed to send error message to user");
    }
  }
}

// ---- Question sender ----

/** Sends the appropriate question message for a given state */
async function sendQuestionForState(
  tg: TelegramClient,
  chatId: number,
  state: string,
  answers: OnboardingAnswers,
): Promise<void> {
  switch (state) {
    case "awaiting_name":
      await tg.sendMessage(chatId, "What should I call you? 😊");
      return;

    case "awaiting_skin_type":
      await tg.sendMessageWithKeyboard(
        chatId,
        `${answers.name ? answers.name + ", t" : "T"}umhara skin type kya lagta hai?`,
        SKIN_TYPE_KEYBOARD,
      );
      return;

    case "awaiting_routine":
      await tg.sendMessageWithKeyboard(chatId, "Abhi kya routine chal rahi hai?", ROUTINE_KEYBOARD);
      return;

    case "awaiting_concern":
      await tg.sendMessageWithKeyboard(chatId, "Skin mein sabse zyada kya bother karta hai?", CONCERN_KEYBOARD);
      return;

    case "awaiting_allergies":
      await tg.sendMessageWithKeyboard(chatId, "Koi allergy ya sensitivity?", ALLERGY_KEYBOARD);
      return;

    case "awaiting_selfie": {
      const name = answers.name ?? "Bestie";
      await tg.sendMessage(
        chatId,
        `${name}, I like how aware you are already! 💕\n\nAb ek selfie bhejo — no filter, close-up, natural light mein 📸\nMain properly dekh ke bataungi kya ho raha hai and kya actually kaam karega.`,
      );
      return;
    }

    default:
      return;
  }
}

// ---- Smart skip logic ----

/**
 * Checks if we can skip the target state because we already have
 * that data in the memory system. Returns the actual next state
 * (which may be further ahead) and updated answers.
 */
async function smartSkipTo(
  targetState: string,
  userId: string,
  answers: OnboardingAnswers,
): Promise<{ state: string; answers: OnboardingAnswers }> {
  const stateOrder = [
    "awaiting_name",
    "awaiting_skin_type",
    "awaiting_routine",
    "awaiting_concern",
    "awaiting_allergies",
    "awaiting_selfie",
  ];

  let currentIdx = stateOrder.indexOf(targetState);
  if (currentIdx === -1) return { state: targetState, answers };

  const identityMems = await getMemoriesByUserAndCategory(userId, "identity");
  const prefMems = await getMemoriesByUserAndCategory(userId, "preference");
  const healthMems = await getMemoriesByUserAndCategory(userId, "health");

  const memoryMap = new Map<string, string>();
  for (const m of [...identityMems, ...prefMems, ...healthMems]) {
    if (m.key) memoryMap.set(m.key, m.value);
  }

  let updated = { ...answers };

  while (currentIdx < stateOrder.length) {
    const state = stateOrder[currentIdx];
    let canSkip = false;

    if (state === "awaiting_name" && memoryMap.has("name") && !updated.name) {
      updated.name = memoryMap.get("name");
      canSkip = true;
    } else if (state === "awaiting_skin_type" && memoryMap.has("skin_type") && !updated.skinType) {
      updated.skinType = memoryMap.get("skin_type");
      canSkip = true;
    } else if (state === "awaiting_routine" && memoryMap.has("routine_level") && !updated.routine) {
      updated.routine = memoryMap.get("routine_level");
      canSkip = true;
    } else if (state === "awaiting_concern" && memoryMap.has("primary_concern") && !updated.concern) {
      updated.concern = memoryMap.get("primary_concern");
      canSkip = true;
    }
    // Don't skip allergies or selfie — always ask

    if (canSkip) {
      currentIdx++;
    } else {
      break;
    }
  }

  const finalState = currentIdx < stateOrder.length
    ? stateOrder[currentIdx]
    : "awaiting_selfie";

  return { state: finalState, answers: updated };
}

// ---- Selfie processing (Steps 9-11) ----

async function handleSelfieStep(
  tg: TelegramClient,
  chatId: number,
  onboardingUserId: string,
  answers: OnboardingAnswers,
  fileId: string,
): Promise<void> {
  try {
    // Mark state as generating
    await updateOnboardingState({ userId: onboardingUserId, state: "generating_profile" });

    // Step 9a: Feedback while processing
    await tg.sendMessage(chatId, "Dekh rahi hoon... 👀");
    await tg.sendChatAction(chatId);

    // Step 9b: Download and upload photo
    const photoBuffer = await tg.downloadFile(fileId);
    const blob = await put(
      `telegram-photos/${onboardingUserId}/${Date.now()}.jpg`,
      photoBuffer,
      { access: "public", contentType: "image/jpeg" },
    );

    // Step 9c: Run scan pipeline
    const imageBase64 = photoBuffer.toString("base64");
    const { scanResult, scanId, comparisonBlock, cycleContext } = await runScanPipeline({
      imageData: imageBase64,
      userId: onboardingUserId,
      imageUrl: blob.url,
    });

    if (!scanResult) {
      await tg.sendMessage(chatId, "Sorry yaar, photo analyze nahi ho payi. Clear selfie bhejo with good lighting! 📸");
      await updateOnboardingState({ userId: onboardingUserId, state: "awaiting_selfie" });
      return;
    }

    // Step 10: Generate Noor's text analysis
    const { buildRuhiSystemPrompt } = await import("@/lib/ai/prompts");
    const { getLanguageModel } = await import("@/lib/ai/providers");
    const { DEFAULT_CHAT_MODEL } = await import("@/lib/ai/models");
    const memoriesBlock = await loadAndFormatMemories(onboardingUserId);

    const scanData = JSON.stringify(scanResult, null, 2);
    const onboardingContext = `User info from onboarding: Name=${answers.name}, Skin type=${answers.skinType}, Routine=${answers.routine}, Main concern=${answers.concern}, Allergies=${answers.allergies?.join(", ")}`;

    const interpretation = await generateText({
      model: getLanguageModel(DEFAULT_CHAT_MODEL),
      system: buildRuhiSystemPrompt(cycleContext, memoriesBlock ?? undefined),
      messages: [{
        role: "user",
        content: `Here are my skin scan results. This is my first analysis — I just completed onboarding.\n\n${onboardingContext}\n\nInterpret the scan results warmly and personally — what's good, what needs attention, and hint that you're making something special for me:\n\n${scanData}${comparisonBlock}`,
      }],
    });

    const analysisText = interpretation.text || "Scan ho gaya! Let me make your profile card...";

    // Send text analysis first (builds anticipation)
    await sendSplitMessages(tg, chatId, analysisText);
    await tg.sendChatAction(chatId);

    // Step 11: Generate and send profile card
    const { getPersonalityLabel } = await import("@/lib/report/personality-labels");
    const { buildProfileCardResponse } = await import("@/lib/report/skin-profile");

    const label = getPersonalityLabel({
      score: scanResult.overall_score,
      concern: answers.concern ?? "overall",
      skinType: answers.skinType ?? "unknown",
      routineLevel: answers.routine ?? "none",
    });

    const imageResponse = buildProfileCardResponse(
      scanResult,
      answers.name ?? "Bestie",
      label,
      new Date(),
    );
    const cardBuffer = Buffer.from(await imageResponse.arrayBuffer());
    await tg.sendPhoto(chatId, cardBuffer, `${answers.name ?? "Your"}'s Skin Profile by meetSakhi.com ✨`);

    // Follow-up: offer to work on their concern
    const concernLabel = CONCERN_LABELS[answers.concern ?? "overall"] ?? "your skin goals";
    await tg.sendMessage(
      chatId,
      `Ye tumhari Skin Profile hai 💕 Save karlo!\n\n${answers.name ?? "Bestie"}, ${concernLabel} ke liye mere paas kuch ideas hain. Want to get into it? 🙌`,
    );

    // Save all answers to memory system
    await flushAnswersToMemory(onboardingUserId, answers, scanResult, "telegram");

    // Mark onboarding complete
    await updateOnboardingState({ userId: onboardingUserId, state: "complete", answers });

    console.log("[Onboarding] Complete for user:", onboardingUserId);
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("[Onboarding] Selfie processing failed:", errMsg);
    await tg.sendMessage(chatId, "Sorry, kuch problem ho gayi analysis mein. Ek aur selfie try karo? 📸");
    await updateOnboardingState({ userId: onboardingUserId, state: "awaiting_selfie" });
  }
}

// ---- Helper: split messages (reused from handler) ----

async function sendSplitMessages(
  tg: TelegramClient,
  chatId: number,
  text: string,
): Promise<void> {
  const chunks = text
    .split("|||")
    .map((c) => c.trim())
    .filter(Boolean);

  for (let i = 0; i < chunks.length; i++) {
    await tg.sendChatAction(chatId);
    if (i > 0) {
      const delay = Math.min(Math.max(chunks[i].length * 50, 800), 3000);
      await new Promise((r) => setTimeout(r, delay));
    }
    await tg.sendMessage(chatId, chunks[i]);
  }
}

/**
 * Re-enter onboarding from "skipped" state.
 * Called when a skipped user asks for skin analysis.
 */
export async function resumeOnboarding(
  tg: TelegramClient,
  chatId: number,
  userId: string,
): Promise<void> {
  const answers: OnboardingAnswers = {};
  const nextState = await smartSkipTo("awaiting_name", userId, answers);
  await upsertOnboarding({ userId, state: nextState.state, answers: nextState.answers });
  await tg.sendMessage(chatId, "Nice! Let's do a quick skin analysis 💕");
  await sendQuestionForState(tg, chatId, nextState.state, nextState.answers);
}
