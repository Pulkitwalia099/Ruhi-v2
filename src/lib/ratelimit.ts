import { createClient } from "redis";

import { isProductionEnvironment } from "@/lib/constants";
import { env } from "@/lib/env";
import { ChatbotError } from "@/lib/errors";

// -----------------------------------------------
// src/lib/ratelimit.ts
//
// const MAX_MESSAGES                          L17
// const TTL_SECONDS                           L18
// let client                                  L20
// function getClient()                        L22
// export async function checkIpRateLimit()    L33
// -----------------------------------------------

const MAX_MESSAGES = 10;
const TTL_SECONDS = 60 * 60;

let client: ReturnType<typeof createClient> | null = null;

function getClient() {
  if (!client && env.REDIS_URL) {
    client = createClient({ url: env.REDIS_URL });
    client.on("error", () => undefined);
    client.connect().catch(() => {
      client = null;
    });
  }
  return client;
}

export async function checkIpRateLimit(ip: string | undefined) {
  if (!isProductionEnvironment || !ip) {
    return;
  }

  const redis = getClient();
  if (!redis?.isReady) {
    return;
  }

  try {
    const key = `ip-rate-limit:${ip}`;
    const [count] = await redis
      .multi()
      .incr(key)
      .expire(key, TTL_SECONDS, "NX")
      .exec();

    if (typeof count === "number" && count > MAX_MESSAGES) {
      throw new ChatbotError("rate_limit:chat");
    }
  } catch (error) {
    if (error instanceof ChatbotError) {
      throw error;
    }
  }
}
