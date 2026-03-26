import { put } from "@vercel/blob";
import { generateText } from "ai";

import { runScanPipeline } from "@/lib/ai/scan-pipeline";
import { loadAndFormatMemories } from "@/lib/memory/loader";
import {
  getOnboarding,
  upsertOnboarding,
  updateOnboardingState,
  upsertMemory,
  insertMemory,
} from "@/db/queries";
import type { OnboardingAnswers } from "@/db/schema";
import type { InstagramClient } from "./client";
import { sendSplitMessages } from "./utils";

// ------------------------------------------------
// src/lib/instagram/onboarding.ts
//
// "Scan-First Progressive Personalization" flow
// for Instagram DMs. Unlike Telegram's 7-step form,
// this gives value FIRST (immediate scan feedback),
// then asks just 2 questions conversationally.
//
// Flow: selfie → first impression → skin type Q →
//       concern Q → full analysis + profile card →
//       friendship opener
// ------------------------------------------------

// ---- Fuzzy text matchers ----

const SKIN_TYPE_PATTERNS: Array<{ pattern: RegExp; value: string }> = [
  { pattern: /\b(oily|oil|greasy|tel|तैलीय|chikni|chipchip)\b/i, value: "oily" },
  { pattern: /\b(dry|sukhi|ruk?hi|सूखी|tight|flaky)\b/i, value: "dry" },
  { pattern: /\b(combin|combo|mixed|dono|both|t-?zone)\b/i, value: "combination" },
  { pattern: /\b(sensitive|sens|react|irritat|lal|redness)\b/i, value: "sensitive" },
  { pattern: /\b(not sure|pata nahi|nahi pata|idk|dunno|no idea|🤷)\b/i, value: "unknown" },
];

const CONCERN_PATTERNS: Array<{ pattern: RegExp; value: string }> = [
  { pattern: /\b(acne|pimple|breakout|muhase|dane|zit)\b/i, value: "acne" },
  { pattern: /\b(pigment|dark spot|daag|dhab|hyperpig|melasma|uneven)\b/i, value: "pigmentation" },
  { pattern: /\b(dull|glow nahi|no glow|lifeless|tired look|radiance)\b/i, value: "dull_skin" },
  { pattern: /\b(dark circle|aankh|under eye|puffy eye|panda)\b/i, value: "dark_circles" },
  { pattern: /\b(every|sab|overall|general|all|improve)\b/i, value: "overall" },
];

/** Parse skin type from freeform text. Returns null if no match. */
export function parseSkinType(text: string): string | null {
  for (const { pattern, value } of SKIN_TYPE_PATTERNS) {
    if (pattern.test(text)) return value;
  }
  return null;
}

/** Parse skin concern from freeform text. Returns null if no match. */
export function parseConcern(text: string): string | null {
  for (const { pattern, value } of CONCERN_PATTERNS) {
    if (pattern.test(text)) return value;
  }
  return null;
}

// ---- Friendly label maps ----

const SKIN_TYPE_LABELS: Record<string, string> = {
  oily: "Oily", dry: "Dry", combination: "Combination",
  sensitive: "Sensitive", unknown: "Not sure",
};

const CONCERN_LABELS: Record<string, string> = {
  acne: "Acne / breakouts", pigmentation: "Pigmentation / dark spots",
  dull_skin: "Dull skin / no glow", dark_circles: "Dark circles",
  overall: "Overall improvement",
};

// ---- First impression generator (template-based, fast) ----

// Import the canonical ScanResults type from skin-report
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
      `Okay wow — first thing I notice? Your skin is actually glowing! ✨\n\n` +
      `I can see ${positive.toLowerCase()}. Love that for you.\n\n` +
      `Let me do a proper deep-dive so I can give you really specific advice...`
    );
  }

  if (score >= 5) {
    return (
      `Interesting! Some really good things happening — ${positive.toLowerCase()} 💕\n\n` +
      `I also notice ${concern.toLowerCase()}. But nothing we can't work on together!\n\n` +
      `Let me analyze properly to give you the full picture...`
    );
  }

  return (
    `Thanks for trusting me with this! 💕\n\n` +
    `I can see some areas we can work on together — ${concern.toLowerCase()}.\n` +
    `But also noticing ${positive.toLowerCase()}, so we've got a good starting point!\n\n` +
    `Let me take a closer look...`
  );
}

// ---- Friendship opener (concern-based follow-up) ----

const FRIENDSHIP_OPENERS: Record<string, string> = {
  acne:
    "Acne ke baare mein — mujhe batao kya products use kar rahi ho? " +
    "Photo bhejo, main check karti hoon ingredients 🧴",
  pigmentation:
    "Pigmentation ke liye ek game-changer hai — niacinamide. " +
    "Use karti ho? Agar nahi toh batao, recommend karungi 💕",
  dull_skin:
    "Glow chahiye? Ek trick — kal subah face wash ke baad ice cube " +
    "rub karo 30 seconds. Thank me later ✨",
  dark_circles:
    "Dark circles mostly hydration + sleep se improve hote hain. " +
    "But topically bhi help kar sakti hoon — want tips?",
  overall:
    "Your skin is a great canvas! Photo bhejo anytime — " +
    "routine tips, product checks, ya bas chat karne ka mann ho 💕",
};

export function generateFriendshipOpener(concern: string): string {
  return FRIENDSHIP_OPENERS[concern] ?? FRIENDSHIP_OPENERS.overall;
}

// ---- Main onboarding handlers ----

/**
 * Called when a first-time user sends their first selfie.
 * Runs the scan, sends the first impression, and asks the first question.
 *
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
  const answers: OnboardingAnswers & {
    _scanResultJson?: string;
    _scanId?: string;
    _blobUrl?: string;
    _cycleContext?: string;
    _comparisonBlock?: string;
  } = {
    name: instagramUsername ?? undefined,
    _scanResultJson: JSON.stringify(scanResult),
    _scanId: scanId,
    _blobUrl: blobUrl,
    _cycleContext: cycleContext ?? undefined,
    _comparisonBlock: comparisonBlock,
  };

  // Create onboarding record
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

  // Ask skin type question
  await ig.sendMessage(
    senderId,
    "Btw, tumhari skin usually oily hoti hai ya dry? Ya combination/sensitive?\n\n" +
      "Just want my advice to be spot-on 💕",
  );
}

/**
 * Called when a user who is mid-onboarding sends a text reply.
 * Parses their answer, advances state, and either asks the next
 * question or generates the full profile card.
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
    : {}) as OnboardingAnswers & {
    _scanResultJson?: string;
    _scanId?: string;
    _blobUrl?: string;
    _cycleContext?: string;
    _comparisonBlock?: string;
  };

  try {
    switch (row.state) {
      case "ig_awaiting_skin_type": {
        const skinType = parseSkinType(text) ?? "unknown";
        answers.skinType = skinType;

        await updateOnboardingState({
          userId,
          state: "ig_awaiting_concern",
          answers: answers as unknown as OnboardingAnswers,
        });

        // Acknowledge + ask concern
        const label = SKIN_TYPE_LABELS[skinType] ?? skinType;
        const ack =
          skinType === "unknown"
            ? "No worries, that's totally fine! We'll figure it out together 😊"
            : `Got it — ${label} skin! That helps a lot.`;

        await ig.sendMessage(senderId, ack);
        await new Promise((r) => setTimeout(r, 800));
        await ig.sendMessage(
          senderId,
          "And koi specific concern hai? Acne, pigmentation, dullness, dark circles?\n\n" +
            "Ya bas overall improve karna hai? 🌟",
        );
        return;
      }

      case "ig_awaiting_concern": {
        const concern = parseConcern(text) ?? "overall";
        answers.concern = concern;

        // Mark as generating
        await updateOnboardingState({
          userId,
          state: "ig_generating_profile",
          answers: answers as unknown as OnboardingAnswers,
        });

        await ig.sendTypingIndicator(senderId);

        // Generate the full personalized analysis + profile card
        await generateProfileAndCard(ig, senderId, userId, answers);
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
    : {}) as OnboardingAnswers & {
    _scanResultJson?: string;
    _scanId?: string;
    _blobUrl?: string;
    _cycleContext?: string;
    _comparisonBlock?: string;
  };

  // Fill in defaults for missing answers
  if (!answers.skinType) answers.skinType = "unknown";
  if (!answers.concern) answers.concern = "overall";

  await updateOnboardingState({
    userId,
    state: "ig_generating_profile",
    answers: answers as unknown as OnboardingAnswers,
  });

  await ig.sendMessage(
    senderId,
    "Ek second — pehli photo se tumhari profile bana rahi hoon! ✨",
  );

  await generateProfileAndCard(ig, senderId, userId, answers);
}

// ---- Profile card generation (Steps 7-11) ----

async function generateProfileAndCard(
  ig: InstagramClient,
  senderId: string,
  userId: string,
  answers: OnboardingAnswers & {
    _scanResultJson?: string;
    _scanId?: string;
    _blobUrl?: string;
    _cycleContext?: string;
    _comparisonBlock?: string;
  },
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

    // Step 7: Generate Noor's personalized analysis
    const { buildRuhiSystemPrompt } = await import("@/lib/ai/prompts");
    const { getLanguageModel } = await import("@/lib/ai/providers");
    const { DEFAULT_CHAT_MODEL } = await import("@/lib/ai/models");
    const memoriesBlock = await loadAndFormatMemories(userId);

    const scanData = JSON.stringify(scanResult, null, 2);
    const name = answers.name ?? "Bestie";
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

    // Step 8: Generate and send Skin Profile Card
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
      routineLevel: "none", // Not collected in IG onboarding
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

    // Step 9: Flush answers to memory system
    await flushAnswersToMemory(userId, answers, scanResult);

    // Step 10: Mark onboarding complete
    await updateOnboardingState({
      userId,
      state: "complete",
      answers: answers as unknown as OnboardingAnswers,
    });

    // Step 11: Friendship opener
    await new Promise((r) => setTimeout(r, 2000));

    const cardMessage = `Ye tumhari Skin Profile hai ${name} 💕 Save karlo!`;
    await ig.sendMessage(senderId, cardMessage);

    await new Promise((r) => setTimeout(r, 1500));

    const opener = generateFriendshipOpener(answers.concern ?? "overall");
    await ig.sendMessage(senderId, opener);

    console.log("[IG Onboarding] Complete for user:", userId);
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

// ---- Memory flush ----

async function flushAnswersToMemory(
  userId: string,
  answers: OnboardingAnswers & { _scanResultJson?: string },
  scanResult: ScanResults,
): Promise<void> {
  try {
    if (answers.name) {
      await upsertMemory({
        userId,
        category: "identity",
        key: "name",
        value: answers.name,
      });
    }
    if (answers.skinType) {
      await upsertMemory({
        userId,
        category: "identity",
        key: "skin_type",
        value: SKIN_TYPE_LABELS[answers.skinType] ?? answers.skinType,
      });
    }
    if (answers.concern) {
      await upsertMemory({
        userId,
        category: "preference",
        key: "primary_concern",
        value: CONCERN_LABELS[answers.concern] ?? answers.concern,
      });
    }
    // Save initial scan summary
    await insertMemory({
      userId,
      category: "health",
      value: `Initial skin scan (Instagram): score ${scanResult.overall_score}/10. ` +
        `Concerns: ${scanResult.key_concerns.join(", ")}. ` +
        `Positives: ${scanResult.positives.join(", ")}.`,
      metadata: { source: "ig_onboarding", score: scanResult.overall_score },
    });
  } catch (err) {
    console.error("[IG Onboarding] Memory flush error:", err);
    // Non-fatal — onboarding still completes
  }
}

