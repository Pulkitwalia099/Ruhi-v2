import { env } from "./env";

// --------------------------------------------
// src/lib/constants.ts
//
// export const isProductionEnvironment     L13
// export const isDevelopmentEnvironment    L14
// export const isTestEnvironment           L15
// export const guestRegex                  L19
// export const suggestions                 L21
// --------------------------------------------

export const isProductionEnvironment = env.NODE_ENV === "production";
export const isDevelopmentEnvironment = env.NODE_ENV === "development";
export const isTestEnvironment = Boolean(
  env.PLAYWRIGHT_TEST_BASE_URL || env.PLAYWRIGHT || env.CI_PLAYWRIGHT
);

export const guestRegex = /^guest-\d+/;

export const suggestions = [
  "My skin feels super dry after washing — kya karu?",
  "Best sunscreen under ₹500 for oily skin?",
  "Niacinamide aur salicylic acid saath mein use kar sakti hoon?",
  "My period just started — skin ke liye kya change karu?",
];
