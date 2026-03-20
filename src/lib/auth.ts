import { compareSync, hashSync } from "bcrypt-ts";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { anonymous } from "better-auth/plugins";
import { nanoid } from "nanoid";
import { db } from "@/db/queries";
import { account, session, user, verification } from "@/db/schema";
import { env } from "./env";

// --------------------------
// src/lib/auth.ts
//
// export const auth      L23
// export type Session    L63
// --------------------------

export const auth = betterAuth({
  secret: env.AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  database: drizzleAdapter(db, {
    provider: "pg",
    usePlural: true,
    schema: {
      users: user,
      sessions: session,
      accounts: account,
      verifications: verification,
    },
  }),
  advanced: {
    database: {
      generateId: () => nanoid(),
    },
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 6,
    password: {
      hash: async (password) => hashSync(password, 10),
      verify: async ({ hash, password }) => compareSync(password, hash),
    },
  },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 7 * 24 * 60 * 60,
    },
  },
  plugins: [
    anonymous({
      generateRandomEmail: () => `guest-${Date.now()}@anon.local`,
    }),
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;
