import { put } from "@vercel/blob";
import { generateText } from "ai";

import { loadAndFormatMemories } from "@/lib/memory/loader";
import {
  getOnboarding,
  upsertOnboarding,
  updateOnboardingState,
} from "@/db/queries";
import type { OnboardingAnswers } from "@/db/schema";
import type { InstagramClient } from "./client";
import { sendSplitMessages } from "./utils";
import { SKIN_TYPE_LABELS, CONCERN_LABELS } from "@/lib/onboarding/labels";
import { parseSkinType, parseConcern, parseRoutine } from "@/lib/onboarding/parsers";
import {
  INTENT_OPTIONS,
  SKIN_TYPE_OPTIONS,
  CONCERN_OPTIONS,
  ROUTINE_OPTIONS,
  RECS_OPTIONS,
  formatOptionsText,
  toQuickReplies,
} from "@/lib/onboarding/questions";
import { flushAnswersToMemory } from "@/lib/onboarding/memory-flush";

// ------------------------------------------------
// src/lib/instagram/onboarding.ts
//
// 3-Path Intent Onboarding for Instagram DMs.
// Matches Telegram's intent-first structure with
// Quick Replies + freeform text fallback.
//
// States:
//   ig_awaiting_intent        — 3 Quick Reply options
//   ig_awaiting_issue_text    — Path 2: free text issue
//   ig_awaiting_skin_type     — Quick Replies + freeform
//   ig_awaiting_concern       — Quick Replies + freeform
//   ig_awaiting_routine       — Quick Replies + freeform
//   ig_awaiting_selfie        — re-prompt if text received
//   ig_generating_profile     — C1: dead-end recovery >90s
//   ig_awaiting_recommendations — post-analysis offer
// ------------------------------------------------

// ---- First impression generator (template-based, fast) ----

import type { ScanResults } from "@/lib/report/skin-report";

/**
 * Generate a warm 3-4 line "first impression" from the scan results.
 * Template-based (no LLM call) for instant feedback.
 */
export function generateFirstImpression(scanResult: ScanResults): string {
  const score = scanResult.overall_score;
  const positives = scanResult.positives ?? [];
  const concerns = scanResult.key_concerns ?? [];

  const positive = positives[0] ?? "some healthy-looking areas";
  const concern = concerns[0] ?? "a few things we can work on";

  if (score >= 8) {
    return (
      `Arre wah, skin toh glow kar rahi hai ✨\n\n` +
      `${positive} dikh raha hai clearly.\n\n` +
      `Let me properly analyze...`
    );
  }

  if (score >= 5) {
    return (
      `Achha so ${positive.toLowerCase()}, that's good 💕\n\n` +
      `${concern} bhi hai but kuch nahi, kaam chalega.\n\n` +
      `Proper analysis karti hoon...`
    );
  }

  return (
    `Dekho, ${concern.toLowerCase()} hai thoda, but ${positive.toLowerCase()} bhi hai toh starting point achha hai.\n\n` +
    `Chalo dekhte hain properly...`
  );
}

// ---- Friendship opener (concern-based follow-up) ----

const FRIENDSHIP_OPENERS: Record<string, string> = {
  acne:
    "Acne ke baare mein, mujhe batao kya products use kar rahi ho? " +
    "Photo bhejo, main check karti hoon ingredients 🧴",
  pigmentation:
    "Pigmentation ke liye ek game-changer hai niacinamide. " +
    "Use karti ho? Agar nahi toh batao, recommend karungi 💕",
  dull_skin:
    "Glow chahiye? Ek trick, kal subah face wash ke baad ice cube " +
    "rub karo 30 seconds. Thank me later ✨",
  dark_circles:
    "Dark circles mostly hydration + sleep se improve hote hain. " +
    "But topically bhi help kar sakti hoon, want tips?",
  overall:
    "Photo bhejo anytime, routine tips, product checks, " +
    "ya bas chat karne ka mann ho 💕",
};

export function generateFriendshipOpener(concern: string): string {
  return FRIENDSHIP_OPENERS[concern] ?? FRIENDSHIP_OPENERS.overall;
}

// ---- Intent guessing from freeform text ----

function guessIntent(text: string): string {
  if (/\b(scan|analysis|analyze|selfie|skin check|dekh)\b/i.test(text)) return "skin_analysis";
  if (/\b(issue|problem|acne|pimple|concern|help|fix|solve)\b/i.test(text)) return "skin_issue";
  return "just_chat";
}

// ---- Extended answers type used throughout onboarding ----

type ExtendedAnswers = OnboardingAnswers & {
  intent?: string;
  issueDescription?: string;
  _scanResultJson?: string;
  _scanId?: string;
  _blobUrl?: string;
  _cycleContext?: string;
  _comparisonBlock?: string;
  [key: string]: unknown; // for retry counters like _retry_ig_awaiting_skin_type
};

// ---- Main onboarding handlers ----

/**
 * Called when a first-time user sends their first selfie.
 * Sends the first impression and asks the first question (skin type).
 * The scan has already been run by the caller — we receive the results.
 */
export async function handleInstagramOnboarding(
  ig: InstagramClient,
  senderId: string,
  userId: string,
  instagramUsername: string | undefined,
  scanResult: ScanResults,
  scanId: string,
  blobUrl: string,
  cycleContext: string | null,
  comparisonBlock: string,
): Promise<void> {
  // Store the scan data in onboarding answers for later use
  const answers: ExtendedAnswers = {
    name: instagramUsername ?? undefined,
    _scanResultJson: JSON.stringify(scanResult),
    _scanId: scanId,
    _blobUrl: blobUrl,
    _cycleContext: cycleContext ?? undefined,
    _comparisonBlock: comparisonBlock,
  };

  // Create onboarding record — jump to skin type since selfie is already done
  await upsertOnboarding({
    userId,
    state: "ig_awaiting_skin_type",
    answers: answers as unknown as OnboardingAnswers,
  });

  // Send first impression (instant, template-based)
  const firstImpression = generateFirstImpression(scanResult);
  await ig.sendMessage(senderId, firstImpression);

  // Small pause for natural pacing
  await new Promise((r) => setTimeout(r, 1500));

  // Ask skin type question with Quick Replies
  const stOpts = formatOptionsText(SKIN_TYPE_OPTIONS);
  await ig.sendQuickReplies(
    senderId,
    `Btw, tumhari skin usually kaisi hoti hai? (${stOpts})\n\nJust want my advice to be spot-on 💕`,
    toQuickReplies(SKIN_TYPE_OPTIONS, "TYPE"),
  );
}

/**
 * Called when a user who is mid-onboarding sends a text reply.
 * Parses their answer, advances state, and either asks the next
 * question or generates the full profile card.
 *
 * States:
 *   ig_awaiting_intent -> ig_awaiting_skin_type | ig_awaiting_issue_text | skipped
 *   ig_awaiting_issue_text -> ig_awaiting_selfie
 *   ig_awaiting_skin_type -> ig_awaiting_concern
 *   ig_awaiting_concern -> ig_awaiting_routine
 *   ig_awaiting_routine -> ig_awaiting_selfie
 *   ig_awaiting_selfie -> (re-prompt, expects photo not text)
 *   ig_generating_profile -> (C1 dead-end recovery)
 *   ig_awaiting_recommendations -> complete
 */
export async function handleOnboardingReply(
  ig: InstagramClient,
  senderId: string,
  userId: string,
  text: string,
): Promise<void> {
  const row = await getOnboarding(userId);
  if (!row) return;

  const answers = (row.answers && typeof row.answers === "object"
    ? row.answers
    : {}) as ExtendedAnswers;

  try {
    // ---- C3: Escape hatch — user wants to skip onboarding ----
    const SKIP_PATTERNS = /\b(skip|chhodo|rehne do|bas baat karo|no selfie|nahi bhejungi|just chat)\b/i;
    if (SKIP_PATTERNS.test(text) && row.state !== "ig_awaiting_intent") {
      await updateOnboardingState({ userId, state: "skipped", answers: answers as unknown as OnboardingAnswers });
      await ig.sendMessage(senderId, "No worries! Jab mann kare tab bhej dena 💕 Batao kya baat karni hai?");
      return;
    }

    // ---- H2: Stale re-orientation (>24h since last interaction) ----
    if (row.updatedAt) {
      const hoursSince = (Date.now() - new Date(row.updatedAt).getTime()) / (1000 * 60 * 60);
      if (hoursSince > 24 && row.state.startsWith("ig_awaiting")) {
        if (text === "REORIENT_restart") {
          await updateOnboardingState({ userId, state: "ig_awaiting_intent", answers: {} as unknown as OnboardingAnswers });
          const optionsText = formatOptionsText(INTENT_OPTIONS);
          await ig.sendQuickReplies(senderId,
            `Fresh start! Batao, what's on your mind? (${optionsText})`,
            toQuickReplies(INTENT_OPTIONS, "INTENT"));
          return;
        }
        if (text !== "REORIENT_continue") {
          await ig.sendQuickReplies(senderId,
            "Hey! Pichli baar baat chal rahi thi, continue kare ya fresh start?",
            [
              { title: "Continue", payload: "REORIENT_continue" },
              { title: "Fresh start", payload: "REORIENT_restart" },
            ]);
          return;
        }
        // "Continue" falls through to normal state handling
      }
    }

    // ---- State machine ----
    switch (row.state) {
      case "ig_awaiting_intent": {
        const intentMap: Record<string, string> = {
          INTENT_skin_analysis: "skin_analysis",
          INTENT_skin_issue: "skin_issue",
          INTENT_just_chat: "just_chat",
        };
        const intent = intentMap[text.trim()] ?? guessIntent(text);

        if (intent === "just_chat") {
          await updateOnboardingState({ userId, state: "skipped", answers: answers as unknown as OnboardingAnswers });
          await ig.sendMessage(senderId, "Cool! Jab chaaho baat karo 💬\n\nSkin analysis chahiye ho toh bas bol dena!");
          return;
        }

        if (intent === "skin_issue") {
          answers.intent = "skin_issue";
          await updateOnboardingState({ userId, state: "ig_awaiting_issue_text", answers: answers as unknown as OnboardingAnswers });
          await ig.sendMessage(senderId, "Batao kya ho raha hai, acne, pigmentation, dryness, kuch bhi. Apne words mein batao!");
          return;
        }

        // skin_analysis
        answers.intent = "skin_analysis";
        await updateOnboardingState({ userId, state: "ig_awaiting_skin_type", answers: answers as unknown as OnboardingAnswers });
        await ig.sendMessage(senderId, "Chal, 2-3 cheezein poochti hoon taaki sahi advice de sakoon");
        await new Promise((r) => setTimeout(r, 800));
        const stOpts = formatOptionsText(SKIN_TYPE_OPTIONS);
        await ig.sendQuickReplies(senderId,
          `Tumhari skin usually kaisi rehti hai? (${stOpts})`,
          toQuickReplies(SKIN_TYPE_OPTIONS, "TYPE"));
        return;
      }

      case "ig_awaiting_issue_text": {
        const detectedConcern = parseConcern(text) ?? "overall";
        answers.concern = detectedConcern;
        answers.issueDescription = text;
        await updateOnboardingState({ userId, state: "ig_awaiting_selfie", answers: answers as unknown as OnboardingAnswers });
        const label = CONCERN_LABELS[detectedConcern] ?? "skin issue";
        await sendSplitMessages(ig, senderId,
          `${label} pe help karungi.|||Ek selfie bhej do, properly dekh ke specific advice de sakti hoon. Natural light, no filter 📸`);
        return;
      }

      case "ig_awaiting_skin_type": {
        // Accept Quick Reply payloads OR freeform text
        const payloadMap: Record<string, string> = {
          TYPE_oily: "oily", TYPE_dry: "dry", TYPE_combination: "combination",
          TYPE_sensitive: "sensitive", TYPE_unknown: "unknown",
        };
        let skinType = payloadMap[text.trim()] ?? parseSkinType(text);

        // H5: Retry counter for failed parses
        const retryKey = "_retry_ig_awaiting_skin_type";
        const retryCount = (answers[retryKey] as number) ?? 0;
        if (!skinType) {
          if (retryCount >= 2) {
            skinType = "unknown"; // auto-default after 3 tries
          } else {
            answers[retryKey] = retryCount + 1;
            await updateOnboardingState({ userId, state: row.state, answers: answers as unknown as OnboardingAnswers });
            const guidance = retryCount === 0
              ? "Woh samajh nahi aaya, type kardo option mein se"
              : `Ek option choose karo: ${formatOptionsText(SKIN_TYPE_OPTIONS)}`;
            await ig.sendMessage(senderId, guidance);
            return;
          }
        }
        skinType = skinType ?? "unknown";
        answers.skinType = skinType;
        await updateOnboardingState({ userId, state: "ig_awaiting_concern", answers: answers as unknown as OnboardingAnswers });

        const ackMap: Record<string, string> = {
          oily: "Oh oily skin, toh lightweight cheezein suit karengi tumhe",
          dry: "Dry skin, toh hydration pe focus rakhenge",
          combination: "Combination, tricky hota hai but manageable",
          sensitive: "Sensitive skin, toh gentle products important hain",
          unknown: "Koi nahi, scan se pata chal jayega",
        };
        const ack = ackMap[skinType] ?? ackMap.unknown;
        await ig.sendMessage(senderId, ack);
        await new Promise((r) => setTimeout(r, 800));
        const cOpts = formatOptionsText(CONCERN_OPTIONS);
        await ig.sendQuickReplies(senderId,
          `Aur sabse bada concern kya hai? (${cOpts})`,
          toQuickReplies(CONCERN_OPTIONS, "CONCERN"));
        return;
      }

      case "ig_awaiting_concern": {
        const payloadMap: Record<string, string> = {
          CONCERN_acne: "acne", CONCERN_pigmentation: "pigmentation",
          CONCERN_dull_skin: "dull_skin", CONCERN_dark_circles: "dark_circles",
          CONCERN_overall: "overall",
        };
        let concern = payloadMap[text.trim()] ?? parseConcern(text);

        // H5: Retry counter
        const retryKey = "_retry_ig_awaiting_concern";
        const retryCount = (answers[retryKey] as number) ?? 0;
        if (!concern) {
          if (retryCount >= 2) {
            concern = "overall"; // auto-default
          } else {
            answers[retryKey] = retryCount + 1;
            await updateOnboardingState({ userId, state: row.state, answers: answers as unknown as OnboardingAnswers });
            const guidance = retryCount === 0
              ? "Woh samajh nahi aaya, type kardo option mein se"
              : `Ek option choose karo: ${formatOptionsText(CONCERN_OPTIONS)}`;
            await ig.sendMessage(senderId, guidance);
            return;
          }
        }
        concern = concern ?? "overall";
        answers.concern = concern;
        await updateOnboardingState({ userId, state: "ig_awaiting_routine", answers: answers as unknown as OnboardingAnswers });

        const concernAckMap: Record<string, string> = {
          acne: "Oh damn acne. Isme definitely help kar sakti hoon",
          pigmentation: "Pigmentation, haan yeh common hai but fixable",
          dull_skin: "Glow nahi aa raha? Chal dekhte hain kya ho raha hai",
          dark_circles: "Dark circles, mostly hydration + sleep but topically bhi help hoti hai",
          overall: "Overall improvement, solid. Dekhte hain kahan se start karein",
        };
        const ack = concernAckMap[concern] ?? concernAckMap.overall;
        await ig.sendMessage(senderId, ack);
        await new Promise((r) => setTimeout(r, 800));
        const rOpts = formatOptionsText(ROUTINE_OPTIONS);
        await ig.sendQuickReplies(senderId,
          `Aur skincare routine kaisi hai abhi? (${rOpts})`,
          toQuickReplies(ROUTINE_OPTIONS, "ROUTINE"));
        return;
      }

      case "ig_awaiting_routine": {
        const payloadMap: Record<string, string> = {
          ROUTINE_basics: "basics", ROUTINE_serious: "serious",
          ROUTINE_full: "full", ROUTINE_none: "none",
        };
        let routine = payloadMap[text.trim()] ?? parseRoutine(text);

        // H5: Retry counter
        const retryKey = "_retry_ig_awaiting_routine";
        const retryCount = (answers[retryKey] as number) ?? 0;
        if (!routine) {
          if (retryCount >= 2) {
            routine = "none"; // auto-default
          } else {
            answers[retryKey] = retryCount + 1;
            await updateOnboardingState({ userId, state: row.state, answers: answers as unknown as OnboardingAnswers });
            const guidance = retryCount === 0
              ? "Woh samajh nahi aaya, type kardo option mein se"
              : `Ek option choose karo: ${formatOptionsText(ROUTINE_OPTIONS)}`;
            await ig.sendMessage(senderId, guidance);
            return;
          }
        }
        routine = routine ?? "none";
        answers.routine = routine;
        await updateOnboardingState({ userId, state: "ig_awaiting_selfie", answers: answers as unknown as OnboardingAnswers });
        await ig.sendMessage(senderId,
          "Samajh gayi. Ab ek selfie bhej do toh proper analysis karke batati hoon 📸 Natural light mein, no filter");
        return;
      }

      case "ig_awaiting_selfie": {
        // User sent text instead of selfie — re-prompt
        await ig.sendMessage(senderId, "Selfie bhejo na! 📸 Close-up, natural light, no filter.");
        return;
      }

      case "ig_generating_profile": {
        // C1: Dead-end recovery — if stuck >90s, it crashed
        const updatedAt = row.updatedAt;
        if (updatedAt) {
          const staleMs = Date.now() - new Date(updatedAt).getTime();
          if (staleMs > 90_000) {
            await updateOnboardingState({ userId, state: "ig_awaiting_selfie", answers: answers as unknown as OnboardingAnswers });
            await ig.sendMessage(senderId, "Sorry yaar, pichli baar kuch issue ho gaya. Ek aur selfie bhej do? 📸");
            return;
          }
        }
        // If <90s, likely still generating — ignore
        return;
      }

      case "ig_awaiting_recommendations": {
        const recsMap: Record<string, string> = {
          RECS_products: "products", RECS_both: "both", RECS_skip: "skip",
        };
        const choice = recsMap[text.trim()] ??
          (/product|haan|yes|batao/i.test(text) ? "products" :
           /home|remedy|dono|both|gharelu/i.test(text) ? "both" : "skip");

        if (choice === "skip") {
          await updateOnboardingState({ userId, state: "complete", answers: answers as unknown as OnboardingAnswers });
          await ig.sendMessage(senderId,
            "No worries! Jab chahiye ho toh bolo, photo bhejo, product check karo, ya bas baat karo 💕");
          return;
        }

        await ig.sendTypingIndicator(senderId);

        // Recover scan data from answers
        const scanResult = answers._scanResultJson ? JSON.parse(answers._scanResultJson) : null;
        if (!scanResult) {
          await updateOnboardingState({ userId, state: "complete", answers: answers as unknown as OnboardingAnswers });
          await ig.sendMessage(senderId, "Scan data nahi mila, next time selfie bhejo toh recommendations de dungi! 💕");
          return;
        }

        const { generateRecommendationText } = await import("@/lib/onboarding/recommendations");
        const recsText = await generateRecommendationText(
          scanResult,
          { skinType: answers.skinType, concern: answers.concern, routine: answers.routine },
          choice === "both",
        );

        await updateOnboardingState({ userId, state: "complete", answers: answers as unknown as OnboardingAnswers });
        await sendSplitMessages(ig, senderId, recsText);

        // Friendship opener after recommendations
        await new Promise((r) => setTimeout(r, 1500));
        const opener = generateFriendshipOpener(answers.concern ?? "overall");
        await ig.sendMessage(senderId, opener);

        console.log("[IG Onboarding] Complete with recommendations for user:", userId);
        return;
      }

      default:
        // Unknown state — shouldn't happen, but fail gracefully
        return;
    }
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("[IG Onboarding] Error:", errMsg);
    try {
      await ig.sendMessage(
        senderId,
        "Sorry yaar, kuch problem ho gayi. Ek minute mein try karo? 🙏",
      );
    } catch {
      // Can't reach user
    }
  }
}

/**
 * Called when a user sends a photo while mid-onboarding.
 * Skips remaining questions and generates the card with defaults.
 */
export async function handleOnboardingPhotoSkip(
  ig: InstagramClient,
  senderId: string,
  userId: string,
): Promise<void> {
  const row = await getOnboarding(userId);
  if (!row) return;

  const answers = (row.answers && typeof row.answers === "object"
    ? row.answers
    : {}) as ExtendedAnswers;

  // Fill in defaults for missing answers
  if (!answers.skinType) answers.skinType = "unknown";
  if (!answers.concern) answers.concern = "overall";
  if (!answers.routine) answers.routine = "none";

  await updateOnboardingState({
    userId,
    state: "ig_generating_profile",
    answers: answers as unknown as OnboardingAnswers,
  });

  await ig.sendMessage(
    senderId,
    "Ek second, pehli photo se tumhari profile bana rahi hoon! ✨",
  );

  await generateProfileAndCard(ig, senderId, userId, answers);
}

/**
 * Called when a user who already answered questions (skin type, concern, routine)
 * sends their selfie. Skips straight to profile card generation using existing answers
 * + the new scan data. Does NOT re-ask questions.
 */
export async function handleSelfieAfterQuestions(
  ig: InstagramClient,
  senderId: string,
  userId: string,
  scanResult: ScanResults,
  scanId: string,
  blobUrl: string,
  cycleContext: string | null,
  comparisonBlock: string,
): Promise<void> {
  const row = await getOnboarding(userId);
  if (!row) return;

  const answers = (row.answers && typeof row.answers === "object"
    ? row.answers
    : {}) as ExtendedAnswers;

  // Store scan data in answers for generateProfileAndCard
  answers._scanResultJson = JSON.stringify(scanResult);
  answers._scanId = scanId;
  answers._blobUrl = blobUrl;
  answers._cycleContext = cycleContext ?? undefined;
  answers._comparisonBlock = comparisonBlock;

  // Fill defaults for any unanswered questions
  if (!answers.skinType) answers.skinType = "unknown";
  if (!answers.concern) answers.concern = "overall";
  if (!answers.routine) answers.routine = "none";

  await updateOnboardingState({
    userId,
    state: "ig_generating_profile",
    answers: answers as unknown as OnboardingAnswers,
  });

  // Send first impression (instant, template-based)
  const firstImpression = generateFirstImpression(scanResult);
  await ig.sendMessage(senderId, firstImpression);

  await new Promise((r) => setTimeout(r, 1500));

  // Go straight to profile card — questions already answered
  await generateProfileAndCard(ig, senderId, userId, answers);
}

// ---- Profile card generation ----

async function generateProfileAndCard(
  ig: InstagramClient,
  senderId: string,
  userId: string,
  answers: ExtendedAnswers,
): Promise<void> {
  try {
    // Recover scan results from onboarding answers
    const scanResult: ScanResults = answers._scanResultJson
      ? JSON.parse(answers._scanResultJson)
      : null;
    const scanId = answers._scanId;

    if (!scanResult) {
      await ig.sendMessage(
        senderId,
        "Hmm, scan data nahi mila. Ek aur selfie bhejo and I'll make your profile! 📸",
      );
      await updateOnboardingState({ userId, state: "complete" });
      return;
    }

    // Generate Noor's personalized analysis
    const { buildRuhiSystemPrompt } = await import("@/lib/ai/prompts");
    const { getLanguageModel } = await import("@/lib/ai/providers");
    const { DEFAULT_CHAT_MODEL } = await import("@/lib/ai/models");
    const memoriesBlock = await loadAndFormatMemories(userId);

    const scanData = JSON.stringify(scanResult, null, 2);
    const name = answers.name ?? "";
    const onboardingContext = [
      `Name: ${name}`,
      `Skin type: ${SKIN_TYPE_LABELS[answers.skinType ?? "unknown"] ?? "Unknown"}`,
      `Main concern: ${CONCERN_LABELS[answers.concern ?? "overall"] ?? "Overall improvement"}`,
    ].join(", ");

    const interpretation = await generateText({
      model: getLanguageModel(DEFAULT_CHAT_MODEL),
      system: buildRuhiSystemPrompt(
        answers._cycleContext ?? undefined,
        memoriesBlock ?? undefined,
      ),
      messages: [
        {
          role: "user",
          content:
            `Here are my skin scan results. This is my first analysis — I just told you about myself.\n\n` +
            `${onboardingContext}\n\n` +
            `Interpret the scan warmly and personally — what's good, what needs attention, ` +
            `and mention you're making something special (my Skin Profile Card):\n\n` +
            `${scanData}${answers._comparisonBlock ?? ""}`,
        },
      ],
    });

    const analysisText =
      interpretation.text ||
      "Scan ho gaya! Let me make your profile card... ✨";

    // Send text analysis (builds anticipation for the card)
    await sendSplitMessages(ig, senderId, analysisText);
    await ig.sendTypingIndicator(senderId);

    // Generate and send Skin Profile Card
    const { getPersonalityLabel } = await import(
      "@/lib/report/personality-labels"
    );
    const { buildProfileCardResponse } = await import(
      "@/lib/report/skin-profile"
    );

    const label = getPersonalityLabel({
      score: scanResult.overall_score,
      concern: answers.concern ?? "overall",
      skinType: answers.skinType ?? "unknown",
      routineLevel: answers.routine ?? "none", // Part D fix: use actual routine, not hardcoded "none"
    });

    const imageResponse = buildProfileCardResponse(
      scanResult,
      name,
      label,
      new Date(),
    );
    const cardBuffer = Buffer.from(await imageResponse.arrayBuffer());

    // Upload to Vercel Blob (Instagram needs a public URL)
    const cardBlob = await put(
      `instagram-profiles/${userId}/${scanId ?? Date.now()}.png`,
      cardBuffer,
      { access: "public", contentType: "image/png" },
    );

    await ig.sendImage(senderId, cardBlob.url);

    // Flush answers to memory system
    await flushAnswersToMemory(userId, answers, scanResult, "instagram");

    // Part C: Offer recommendations via Quick Replies instead of friendship opener
    const recsOpts = formatOptionsText(RECS_OPTIONS);
    await ig.sendQuickReplies(
      senderId,
      `Ye tumhari Skin Profile hai${name ? " " + name : ""}, save karlo! Ab jab tumhari skin samajh gayi, kuch suggest karoon? Mere paas kuch options hain (${recsOpts})`,
      toQuickReplies(RECS_OPTIONS, "RECS"),
    );

    await updateOnboardingState({
      userId,
      state: "ig_awaiting_recommendations",
      answers: answers as unknown as OnboardingAnswers,
    });

    console.log("[IG Onboarding] Profile card sent, awaiting recommendations choice for user:", userId);
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("[IG Onboarding] Profile generation failed:", errMsg);
    await ig.sendMessage(
      senderId,
      "Sorry, profile banane mein kuch issue aaya. But your scan is saved! " +
        "Next time selfie bhejogi toh better analysis milegi 💕",
    );
    await updateOnboardingState({ userId, state: "complete" });
  }
}
