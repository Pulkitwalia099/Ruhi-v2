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
  "What are the advantages of using Next.js?",
  "Write code to demonstrate Dijkstra's algorithm",
  "Help me write an essay about Silicon Valley",
  "What is the weather in San Francisco?",
];
