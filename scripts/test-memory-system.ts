/**
 * Sprint 2 Memory System — Integration Test
 * Run: npx tsx scripts/test-memory-system.ts
 *
 * Tests all memory operations against the real Neon database,
 * then cleans up test data.
 */

import {
  upsertMemory,
  insertMemory,
  insertMomentMemory,
  loadMemories,
  findMemoryByKey,
  deleteExpiredMemories,
  clearTelegramHistory,
  getTelegramHistory,
  getUserByTelegramId,
} from "../src/db/queries";
import { loadAndFormatMemories } from "../src/lib/memory/loader";
import { runPostHocSafetyNet } from "../src/lib/memory/safety-net";
import { db } from "../src/db/queries";
import { memory } from "../src/db/schema";
import { eq } from "drizzle-orm";

// Load .env.local (Vercel convention)
import { config } from "dotenv";
config({ path: ".env.local" });

const TEST_PREFIX = "[MemoryTest]";
let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.log(`  ❌ ${label}`);
    failed++;
  }
}

async function main() {
  // Find real user from Telegram (the one we just approved)
  const telegramUser = await getUserByTelegramId({
    telegramId: BigInt(8492212211),
  });

  if (!telegramUser) {
    console.error(`${TEST_PREFIX} No user found for Telegram ID 8492212211`);
    process.exit(1);
  }

  const userId = telegramUser.id;
  console.log(`${TEST_PREFIX} Using user: ${userId}\n`);

  try {
    // Clean slate — remove any leftover memories from previous runs
    await db.delete(memory).where(eq(memory.userId, userId));

    // ---- Test 1: Identity upsert ----
    console.log("Test 1: Identity upsert");
    const m1 = await upsertMemory({
      userId,
      category: "identity",
      key: "name",
      value: "Priya",
    });
    assert(!!m1, "Insert identity memory");

    const m1b = await upsertMemory({
      userId,
      category: "identity",
      key: "name",
      value: "Priya Sharma",
    });
    assert(!!m1b, "Upsert updates existing identity");

    const found = await findMemoryByKey({
      userId,
      category: "identity",
      key: "name",
    });
    assert(found?.value === "Priya Sharma", "Upserted value is correct");

    // ---- Test 2: Preference upsert ----
    console.log("\nTest 2: Preference upsert");
    await upsertMemory({
      userId,
      category: "preference",
      key: "budget",
      value: "under ₹500 per product",
    });
    const budgetMem = await findMemoryByKey({
      userId,
      category: "preference",
      key: "budget",
    });
    assert(budgetMem?.value === "under ₹500 per product", "Preference saved");

    // ---- Test 3: Health insert (accumulate) ----
    console.log("\nTest 3: Health insert");
    await insertMemory({
      userId,
      category: "health",
      value: "Using Minimalist 10% niacinamide serum",
      metadata: { status: "active" },
    });
    await insertMemory({
      userId,
      category: "health",
      value: "Stopped retinol — caused peeling",
      metadata: { status: "stopped" },
    });
    const healthMems = (await loadMemories({ userId })).filter(
      (m) => m.category === "health",
    );
    assert(healthMems.length === 2, "Two health memories accumulated");

    // ---- Test 4: Context with expiry ----
    console.log("\nTest 4: Context with auto-expiry");
    await insertMemory({
      userId,
      category: "context",
      value: "Travelling to Goa this weekend",
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    });
    const contextMems = (await loadMemories({ userId })).filter(
      (m) => m.category === "context",
    );
    assert(contextMems.length === 1, "Context memory with expiry saved");
    assert(contextMems[0]?.expiresAt !== null, "expiresAt is set");

    // ---- Test 5: Moment insert ----
    console.log("\nTest 5: Moment insert");
    await insertMomentMemory({
      userId,
      value: "Stressed about new job",
    });
    const momentMems = (await loadMemories({ userId })).filter(
      (m) => m.category === "moment",
    );
    assert(momentMems.length === 1, "Moment memory saved");

    // ---- Test 6: Load and format memories ----
    console.log("\nTest 6: Load and format memories");
    const formatted = await loadAndFormatMemories(userId);
    assert(formatted !== null, "Formatted block is not null");
    assert(formatted!.includes("Priya Sharma"), "Contains identity");
    assert(formatted!.includes("niacinamide"), "Contains health");
    assert(formatted!.includes("₹500"), "Contains preference");
    assert(formatted!.includes("Goa"), "Contains context");
    assert(formatted!.includes("Stressed"), "Contains moment");
    assert(
      formatted!.includes("What You Remember"),
      "Has correct heading",
    );
    console.log("\n--- Formatted block preview ---");
    console.log(formatted!.substring(0, 500));
    console.log("--- end preview ---\n");

    // ---- Test 7: Safety net ----
    console.log("Test 7: Post-hoc safety net");
    // First delete existing identity memories so safety net can create them
    await db.delete(memory).where(eq(memory.userId, userId));

    await runPostHocSafetyNet(userId, "My skin is oily and I live in Mumbai");
    const skinType = await findMemoryByKey({
      userId,
      category: "identity",
      key: "skin_type",
    });
    const city = await findMemoryByKey({
      userId,
      category: "identity",
      key: "city",
    });
    assert(skinType?.value === "oily", "Safety net caught skin_type");
    assert(city?.value === "Mumbai", "Safety net caught city");

    // ---- Test 8: Delete expired ----
    console.log("\nTest 8: Expired memory cleanup");
    await insertMemory({
      userId,
      category: "context",
      value: "Old expired memory",
      expiresAt: new Date(Date.now() - 1000), // already expired
    });
    const deletedCount = await deleteExpiredMemories();
    assert(deletedCount >= 1, `Deleted ${deletedCount} expired memories`);

    // ---- Cleanup test data ----
    console.log("\nCleaning up test memories...");
    await db.delete(memory).where(eq(memory.userId, userId));
    const remaining = await loadMemories({ userId });
    assert(remaining.length === 0, "All test memories cleaned up");

    // ---- Clear Telegram conversation ----
    console.log("\nClearing Telegram conversation history...");
    const telegramChatId = Number(telegramUser.telegramId);
    const before = await getTelegramHistory({
      telegramChatId,
      limit: 100,
    });
    console.log(`  Found ${before.length} messages to clear`);
    await clearTelegramHistory({ telegramChatId });
    const after = await getTelegramHistory({ telegramChatId, limit: 100 });
    assert(after.length === 0, "Telegram history cleared");

  } catch (error) {
    console.error(`\n${TEST_PREFIX} FATAL:`, error);
    failed++;
  }

  // ---- Summary ----
  console.log(`\n${"=".repeat(40)}`);
  console.log(`${TEST_PREFIX} Results: ${passed} passed, ${failed} failed`);
  console.log(`${"=".repeat(40)}`);

  process.exit(failed > 0 ? 1 : 0);
}

main();
