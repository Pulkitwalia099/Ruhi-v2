# GTM Features Spec — Product Scanner, Skin Report Card, Shelf Rating

**Date:** 2026-03-22
**Status:** Ready for implementation
**Dependencies:** Noor v4 prompt (deployed), existing scan pipeline

---

## Feature 1: Product Scanner

### What
User sends a photo of a product (label, bottle, Nykaa screenshot) → Noor reads ingredients → gives personalized verdict based on user's skin type, concerns, and sensitivities.

### Current State
- Photo handler exists in `src/lib/telegram/handler.ts`
- ALL photos currently go through selfie skin analysis pipeline
- Vision model: Gemini 2.5 Flash with structured output
- Images uploaded to Vercel Blob

### Implementation

#### Step 1: Intent Classification in Photo Handler

**File:** `src/lib/telegram/handler.ts` (modify photo path)

Before the scan pipeline, add an intent classification step:

```ts
// First, classify the photo intent
const intentResult = await generateText({
  model: getLanguageModel("google/gemini-2.5-flash"),
  messages: [
    {
      role: "user",
      content: [
        { type: "image", image: imageBuffer },
        { type: "text", text: "Is this a selfie/face photo or a product/label/bottle photo? Reply with exactly one word: 'selfie' or 'product'." },
      ],
    },
  ],
});

const intent = intentResult.text.trim().toLowerCase();
```

Then branch:
- `intent === "selfie"` → existing scan pipeline
- `intent === "product"` → new product analysis pipeline

#### Step 2: Product Analysis Pipeline

**File:** `src/lib/ai/tools/analyze-product.ts` (new)

NOT a tool (the LLM can't call itself with an image). Instead, a function called from the handler:

```ts
export async function analyzeProductPhoto(
  imageBuffer: Buffer,
  userId: string,
  memoriesBlock?: string,
): Promise<string> {
  // Load user context for personalization
  const result = await generateText({
    model: getLanguageModel("google/gemini-2.5-flash"),
    system: `You are Noor, a skincare expert analyzing a product photo.
      Read the product name and ingredient list from the image.
      ${memoriesBlock || ""}

      Analyze:
      1. Key active ingredients and what they do
      2. Any problematic ingredients (SLS, high-comedogenic, fragrance)
      3. Suitability for this user's skin type and concerns
      4. Overall verdict: X/10 with one-line reasoning
      5. If not suitable, suggest a specific alternative product

      Respond in Hinglish. Keep it concise — 3-4 sentences max.
      If you can't read the label clearly, say so and ask for a clearer photo.`,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", image: imageBuffer },
          { type: "text", text: "Analyze this product for my skin." },
        ],
      },
    ],
  });

  return result.text;
}
```

#### Step 3: Wire into Handler

In the photo path of `handler.ts`, after intent classification:

```ts
if (intent === "product") {
  const memoriesBlock = await loadAndFormatMemories(userId);
  const analysis = await analyzeProductPhoto(imageBuffer, userId, memoriesBlock);
  // Send analysis as Telegram message (with ||| splitting)
  // Save product to memory if identified
  return;
}
// else: existing scan pipeline
```

### Prompt Discovery (already deployed)
The v4 prompt tells Noor to suggest "photo bhej do product ki" when users mention products.

### Testing
- Send a photo of a product label → should get ingredient analysis, not skin scan
- Send a selfie → should still get skin scan (no regression)
- Send an ambiguous photo → should handle gracefully

---

## Feature 2: Skin Report Card

### What
After a selfie scan, generate a shareable visual report card (PNG image) that users can post on Instagram/WhatsApp.

### Current State
- Scan results stored in `scans` table with JSONB `results` column
- Contains: overallScore, zones (6 facial zones with severity), keyConcerns, positives
- NO image generation capability currently

### Implementation

#### Step 1: Install Satori + @vercel/og

```bash
pnpm add @vercel/og
```

`@vercel/og` bundles Satori and provides `ImageResponse` for Next.js.

#### Step 2: Report Card API Route

**File:** `src/app/api/skin-report/[scanId]/route.tsx` (new)

```tsx
import { ImageResponse } from "@vercel/og";
import { getScanById } from "@/db/queries";

export const runtime = "edge";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ scanId: string }> },
) {
  const { scanId } = await params;
  const scan = await getScanById(scanId);

  if (!scan) {
    return new Response("Scan not found", { status: 404 });
  }

  const results = scan.results as ScanOutput;

  return new ImageResponse(
    (
      <div style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        backgroundColor: "#0a0a0a",
        color: "#ffffff",
        fontFamily: "Inter, sans-serif",
        padding: "60px",
      }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 28, fontWeight: 700 }}>✨ NOOR SKIN REPORT</span>
          <span style={{ fontSize: 18, color: "#888" }}>
            {new Date(scan.createdAt).toLocaleDateString("en-IN")}
          </span>
        </div>

        {/* Overall Score */}
        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          marginTop: 40,
          marginBottom: 40,
        }}>
          <span style={{ fontSize: 72, fontWeight: 800 }}>
            {results.overallScore}/10
          </span>
          <span style={{ fontSize: 20, color: "#aaa" }}>Overall Skin Score</span>
        </div>

        {/* Zone scores - render as bars */}
        {/* Key concerns */}
        {/* Positives */}
        {/* Referral link at bottom */}
        <div style={{
          display: "flex",
          justifyContent: "center",
          marginTop: "auto",
          padding: 20,
          borderTop: "1px solid #333",
        }}>
          <span style={{ fontSize: 16, color: "#666" }}>
            Get your skin analyzed → t.me/SakhiyaanBot
          </span>
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1920, // Instagram story size
    },
  );
}
```

#### Step 3: DB Query — getScanById

**File:** `src/db/queries.ts` (add function)

```ts
export async function getScanById(scanId: string) {
  const [result] = await db
    .select()
    .from(scan)
    .where(eq(scan.id, scanId))
    .limit(1);
  return result ?? null;
}
```

#### Step 4: Send Report Card After Scan

**File:** `src/lib/telegram/handler.ts` (modify scan completion path)

After scan results are saved and the text response is sent:

```ts
// Generate report card URL
const reportUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/skin-report/${scanId}`;

// Download image and send via Telegram
const imageResponse = await fetch(reportUrl);
const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

await bot.api.sendPhoto(chatId, new InputFile(imageBuffer, "skin-report.png"), {
  caption: "Tumhara Skin Report Card 📊 Share karo agar chahti ho!",
});
```

### Design Notes
- Dark theme (matches Sakhiyaan brand)
- Instagram story dimensions (1080x1920)
- Referral link at bottom: `t.me/SakhiyaanBot`
- Score bars with color coding (red < 5, yellow 5-7, green > 7)
- Cycle phase shown if available

### Testing
- Trigger a selfie scan → should get text analysis + report card image
- Report card URL should be accessible as standalone image
- Image renders correctly on mobile screens

---

## Feature 3: Shelf Rating (Routine Analysis)

### What
User shares their full AM/PM routine → Noor scores it as a SYSTEM and identifies conflicts, gaps, and optimizations — personalized to skin type, cycle, season, concerns, budget.

### Current State
- Already deployed in v4 prompt (PULLING USERS INTO FEATURES section)
- Noor can do this conversationally RIGHT NOW — it's prompt-driven
- No separate tool needed for v1

### What's Already Live
The v4 prompt has complete routine analysis instructions:
- Ingredient conflicts (retinol + AHA, benzoyl peroxide + vitamin C)
- Missing essentials (moisturizer, SPF)
- Wrong order (thick before thin)
- Seasonal mismatch
- Cycle alignment
- Goal alignment
- Redundancy detection
- Budget optimization
- Format: Score → Working → Fix → Upgraded routine

### Optional Enhancement: `analyzeRoutine` Tool (v2)

Only build if conversational analysis isn't good enough. The tool would:
1. Structure the routine data
2. Load all user context (memories, cycle, scan history)
3. Pass structured context to the LLM for analysis

**File:** `src/lib/ai/tools/analyze-routine.ts` (new, optional)

```ts
export const analyzeRoutine = tool({
  description: "Analyze a user's complete skincare routine as a system. " +
    "Call this when the user shares multiple products or asks to rate their routine.",
  inputSchema: z.object({
    userId: z.string(),
    amProducts: z.array(z.string()).describe("Morning products in order of application"),
    pmProducts: z.array(z.string()).describe("Night products in order of application"),
  }),
  execute: async ({ userId, amProducts, pmProducts }) => {
    const memories = await loadMemories(userId);
    const latestCycle = await getLatestCycle({ userId });
    const cyclePhase = latestCycle
      ? calculateCyclePhase(latestCycle.periodStart, latestCycle.cycleLength)
      : null;

    return {
      routine: { am: amProducts, pm: pmProducts },
      userContext: {
        skinType: memories.find(m => m.key === "skin_type")?.value,
        concerns: memories.filter(m => m.category === "health").map(m => m.value),
        budget: memories.find(m => m.key === "budget")?.value,
        sensitivities: memories.find(m => m.key === "fragrance")?.value,
        cyclePhase: cyclePhase?.phase,
        cycleDay: cyclePhase?.cycleDay,
      },
      instruction: "Analyze this routine as a SYSTEM. Score out of 10. " +
        "Check: ingredient conflicts, missing essentials, product order, " +
        "seasonal fit, cycle alignment, goal alignment, redundancies, budget optimization. " +
        "Give: score, what's working (2-3), what to fix (max 3 changes), upgraded routine with specific swaps.",
    };
  },
});
```

### Discovery (already deployed)
Noor surfaces this when user mentions 2+ products: "Poora routine batao — AM aur PM dono."

### Testing
- Send: "my routine is CeraVe cleanser, niacinamide, sunscreen" → Noor should offer to analyze full routine
- Send full AM/PM routine → should get system-level score with conflicts/gaps
- Personalization: should reference known skin type, budget, cycle from memory

---

## Implementation Order

```
Step 1: Product Scanner (highest GTM impact)
  ├── Intent classification in handler
  ├── analyzeProductPhoto function
  └── Wire into photo path

Step 2: Skin Report Card
  ├── Install @vercel/og
  ├── getScanById query
  ├── Report card API route
  └── Send image after scan in handler

Step 3: Shelf Rating Tool (optional, only if conversational isn't enough)
  ├── analyzeRoutine tool
  ├── Export from tools index
  └── Add to agent tools
```

## Files to Create/Modify

| File | Action | Feature |
|---|---|---|
| `src/lib/telegram/handler.ts` | Modify — add intent classification + product branch | Product Scanner |
| `src/lib/ai/analyze-product.ts` | New — product photo analysis function | Product Scanner |
| `src/app/api/skin-report/[scanId]/route.tsx` | New — Satori image generation | Report Card |
| `src/db/queries.ts` | Modify — add getScanById | Report Card |
| `src/lib/ai/tools/analyze-routine.ts` | New (optional) — structured routine analysis | Shelf Rating |
| `src/lib/ai/tools/index.ts` | Modify — export new tools | Both |
| `src/lib/ai/agent.ts` | Modify — add new tools to agent | Both |

---

## Risk Notes

1. **Intent classification latency** — adds one extra LLM call to every photo. Consider caching or using a lighter model. Could also use heuristics first (face detection → selfie, text detection → product).
2. **Satori edge runtime** — `@vercel/og` requires edge runtime. If `getScanById` uses Drizzle ORM (Node.js), may need a separate fetch to a Node API route.
3. **Product scanner accuracy** — vision model may misread small text or blurry labels. Need graceful fallback: "Label clearly nahi dikh raha — ek aur photo bhejo thoda close up."
4. **Indian product labels** — some labels are in Hindi/regional languages. Gemini handles this but accuracy may vary.
5. **Report card sharing on Telegram** — sending images as photos (not documents) ensures preview in chat. File size must stay under 10MB.
