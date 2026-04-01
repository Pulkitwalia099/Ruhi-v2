import { z } from "zod";

// -----------------------
// src/lib/env.ts
//
// const isServer      L12
// const envSchema     L14
// export const env    L61
// export type Env     L65
// -----------------------

const isServer = typeof window === "undefined";

const envSchema = z.object({
  // --- Database ---
  DATABASE_URL: isServer ? z.string().min(1) : z.string().optional(),

  // --- Auth ---
  AUTH_SECRET: isServer ? z.string().min(1) : z.string().optional(),
  BETTER_AUTH_URL: z.string().optional().default("http://localhost:3000"),

  // --- AI Providers (set the ones you use) ---
  OPENAI_API_KEY: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  GOOGLE_GENERATIVE_AI_API_KEY: z.string().optional(),

  // --- Storage ---
  BLOB_READ_WRITE_TOKEN: z.string().optional(),

  // --- Search (optional — skincare knowledge web search) ---
  SERPER_API_KEY: z.string().optional(),

  // --- Redis (optional — resumable streams + rate limiting) ---
  REDIS_URL: z.string().optional(),

  // --- Deployment ---
  IS_DEMO: z
    .enum(["0", "1"])
    .optional()
    .transform((val) => val === "1"),
  NEXT_PUBLIC_BASE_PATH: z.string().optional().default(""),

  // --- Bot integrations (optional — set the ones you use) ---
  DISCORD_BOT_TOKEN: z.string().optional(),
  DISCORD_PUBLIC_KEY: z.string().optional(),
  DISCORD_APPLICATION_ID: z.string().optional(),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_WEBHOOK_SECRET: z.string().optional(),
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_APP_SECRET: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_VERIFY_TOKEN: z.string().optional(),
  CRON_SECRET: z.string().optional(),

  // --- Runtime ---
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .optional()
    .default("development"),
  PLAYWRIGHT_TEST_BASE_URL: z.string().optional(),
  PLAYWRIGHT: z.string().optional(),
  CI_PLAYWRIGHT: z.string().optional(),
});

export const env = envSchema.parse(
  typeof process === "undefined" ? {} : process.env
);

export type Env = z.infer<typeof envSchema>;
