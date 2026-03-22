import { findMemoryByKey, upsertMemory, insertMemory } from "@/db/queries";

/**
 * Post-hoc regex safety net.
 * Catches critical identity facts and product mentions the LLM might have missed saving.
 * Runs after every message — costs zero LLM tokens.
 * Never throws — failures are logged and swallowed.
 */
export async function runPostHocSafetyNet(
  userId: string,
  userText: string,
): Promise<void> {
  try {
    await Promise.all([
      checkSkinType(userId, userText),
      checkName(userId, userText),
      checkCity(userId, userText),
      checkGender(userId, userText),
      checkProducts(userId, userText),
    ]);
  } catch (error) {
    // Safety net must never affect the conversation
    console.error("[SafetyNet] Error:", error);
  }
}

async function checkSkinType(userId: string, text: string) {
  const match = text.match(
    /(?:my skin is|skin type is|I have|meri skin|skin hai)\s+(oily|dry|combination|sensitive|normal|acne[- ]prone)/i,
  );
  if (!match) return;

  const existing = await findMemoryByKey({
    userId,
    category: "identity",
    key: "skin_type",
  });
  if (existing) return;

  await upsertMemory({
    userId,
    category: "identity",
    key: "skin_type",
    value: match[1].toLowerCase(),
  });
  console.log("[SafetyNet] Saved skin_type:", match[1]);
}

async function checkName(userId: string, text: string) {
  const match = text.match(
    /(?:my name is|I'm|I am|mera naam|naam hai|main)\s+([A-Z][a-z]+)/i,
  );
  if (!match) return;

  const existing = await findMemoryByKey({
    userId,
    category: "identity",
    key: "name",
  });
  if (existing) return;

  await upsertMemory({
    userId,
    category: "identity",
    key: "name",
    value: match[1],
  });
  console.log("[SafetyNet] Saved name:", match[1]);
}

async function checkCity(userId: string, text: string) {
  const match = text.match(
    /(?:I live in|I'm from|based in|main .+ se hoon|rehti hoon|rehta hoon)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
  );
  if (!match) return;

  const existing = await findMemoryByKey({
    userId,
    category: "identity",
    key: "city",
  });
  if (existing) return;

  await upsertMemory({
    userId,
    category: "identity",
    key: "city",
    value: match[1],
  });
  console.log("[SafetyNet] Saved city:", match[1]);
}

async function checkGender(userId: string, text: string) {
  // Match explicit gender statements in English and Hinglish
  const femaleMatch = text.match(
    /(?:I'm a girl|I am a girl|I'm a woman|I am a woman|I'm female|main ladki|ladki hoon|female hoon)/i,
  );
  const maleMatch = text.match(
    /(?:I'm a boy|I am a boy|I'm a man|I am a man|I'm male|main ladka|ladka hoon|male hoon)/i,
  );

  const gender = femaleMatch ? "female" : maleMatch ? "male" : null;
  if (!gender) return;

  // Always upsert gender — user might be correcting a previous value
  await upsertMemory({
    userId,
    category: "identity",
    key: "gender",
    value: gender,
  });
  console.log("[SafetyNet] Saved gender:", gender);
}

async function checkProducts(userId: string, text: string) {
  // Match common product mention patterns
  // "I use X", "using X", "X use karti/karta hoon", "X lagati/lagata hoon"
  const patterns = [
    /(?:I use|I'm using|using|I apply|started using|started)\s+(.+?)(?:\s+(?:for|on|since|from)|[.,!?]|$)/i,
    /(.+?)\s+(?:use karti|use karta|use kar rahi|use kar raha|lagati|lagata|laga rahi|laga raha)\s+(?:hoon|hun|hai)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match || !match[1]) continue;

    const product = match[1].trim();
    // Skip very short or very long matches (likely false positives)
    if (product.length < 3 || product.length > 80) continue;
    // Skip if it's just a generic word
    if (/^(it|this|that|yeh|woh|kuch)$/i.test(product)) continue;

    await insertMemory({
      userId,
      category: "health",
      value: `Using ${product}`,
      metadata: { status: "active" },
    });
    console.log("[SafetyNet] Saved product:", product);
    return; // Only save one product per message to avoid duplicates
  }
}
