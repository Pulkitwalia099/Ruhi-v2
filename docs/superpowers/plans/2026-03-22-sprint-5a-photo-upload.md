# Sprint 5A: Photo Upload from Web Chat — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Users can send selfie photos in the web chat and receive Ruhi's skin analysis — same quality as Telegram (Gemini Vision → scan comparison → Ruhi interpretation).

**Architecture:** The client-side `MultimodalInput` already has file upload infrastructure (upload to Vercel Blob via `/api/files/upload`, preview thumbnails, attachments sent as `file` parts). We add: (1) client-side image resize before upload, (2) `accept="image/*" capture="user"` on the file input, (3) drag-and-drop, (4) a shared scan pipeline module extracted from the Telegram handler, and (5) image detection + scan branching in `route.ts`.

**Tech Stack:** Next.js App Router, AI SDK v6, Vercel Blob, Gemini Vision (`google/gemini-2.5-flash`), HTML Canvas (client-side resize), Zod

**Spec:** `docs/specs/2026-03-21-photo-upload-web-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/lib/ai/scan-pipeline.ts` | Create | Shared scan logic: Gemini Vision call, compare scans, save scan, get cycle context |
| `src/lib/image-utils.ts` | Create | Client-side image resize utility (canvas-based) |
| `src/components/chat/multimodal-input.tsx` | Modify | Add `accept`/`capture` to file input, add drag-and-drop, integrate resize before upload, fix send button to allow image-only sends |
| `src/app/(chat)/api/chat/route.ts` | Modify | Detect image attachments, branch into scan pipeline |
| `src/lib/telegram/handler.ts` | Modify | Refactor to use shared scan-pipeline |
| `src/app/(chat)/api/files/upload/route.ts` | Modify | Store uploads under `web-photos/{userId}/` path |

---

## Task 1: Create shared scan pipeline module

**Files:**
- Create: `src/lib/ai/scan-pipeline.ts`
- Reference: `src/lib/telegram/handler.ts:104-242` (logic to extract)

This extracts the Gemini Vision analysis + scan comparison + scan saving logic from the Telegram handler into a reusable module.

- [ ] **Step 1: Create the scan pipeline module**

```typescript
// src/lib/ai/scan-pipeline.ts

import { generateText, Output } from "ai";
import { z } from "zod";
import { getLanguageModel } from "@/lib/ai/providers";
import { VISION_MODEL } from "@/lib/ai/models";
import { calculateCyclePhase } from "@/lib/ai/tools/cycle-utils";
import { compareScans } from "@/lib/scan/comparator";
import { getLatestCycle, getRecentScans, insertScan } from "@/db/queries";

export const scanSchema = z.object({
  zones: z.object({
    forehead: z.object({ condition: z.string(), severity: z.number(), clinical_notes: z.string() }),
    t_zone: z.object({ condition: z.string(), severity: z.number(), clinical_notes: z.string() }),
    left_cheek: z.object({ condition: z.string(), severity: z.number(), clinical_notes: z.string() }),
    right_cheek: z.object({ condition: z.string(), severity: z.number(), clinical_notes: z.string() }),
    chin: z.object({ condition: z.string(), severity: z.number(), clinical_notes: z.string() }),
    jawline: z.object({ condition: z.string(), severity: z.number(), clinical_notes: z.string() }),
  }),
  overall_score: z.number(),
  key_concerns: z.array(z.string()),
  positives: z.array(z.string()),
});

export type ScanOutput = z.infer<typeof scanSchema>;

export interface ScanPipelineResult {
  scanResult: ScanOutput | null;
  comparisonBlock: string;
  cycleContext: string;
}

/**
 * Run the full scan analysis pipeline:
 * 1. Gemini Vision structured analysis
 * 2. Save scan to DB
 * 3. Compare with previous scan
 * 4. Get cycle context
 */
export async function runScanPipeline(options: {
  imageData: string;       // base64 string (no data URL prefix)
  userId: string;
  imageUrl: string;        // Blob URL after upload
}): Promise<ScanPipelineResult> {
  const { imageData, userId, imageUrl } = options;

  // Get cycle context
  let cycleContext = "";
  let cycleDay: number | undefined;
  let cyclePhase: string | undefined;
  const cycle = await getLatestCycle({ userId });
  if (cycle) {
    const phase = calculateCyclePhase(cycle.periodStart, cycle.cycleLength);
    cycleDay = phase.cycleDay;
    cyclePhase = phase.phase;
    cycleContext = `\nCycle context: Day ${phase.cycleDay}, ${phase.phase} phase. ${phase.skinImplications}`;
  }

  // Get recent scan history for context
  const recentScans = await getRecentScans({ userId, limit: 3 });
  let historyContext = "";
  if (recentScans.length > 0) {
    historyContext = `\nPrevious scans:\n${JSON.stringify(
      recentScans.map((s) => ({
        date: s.createdAt.toISOString().split("T")[0],
        results: s.results,
      })), null, 2)}`;
  }

  // Step 1: Gemini Vision structured analysis
  const scanResult = await generateText({
    model: getLanguageModel(VISION_MODEL),
    output: Output.object({ schema: scanSchema }),
    messages: [{
      role: "user",
      content: [
        {
          type: "text",
          text: `You are a clinical dermatology AI. Analyze this selfie objectively across 6 facial zones: forehead, t_zone, left_cheek, right_cheek, chin, jawline.

For each zone provide:
- condition: clinical observation (acne, dryness, oiliness, clear, texture issues, hyperpigmentation, etc.)
- severity: 1-10 where 10 = perfectly healthy skin, 1 = severe concern
- clinical_notes: brief clinical assessment
${cycleContext}${historyContext}

Also provide:
- overall_score: 1-10 (10 = excellent skin health)
- key_concerns: array of top 2-3 issues found
- positives: array of things that look good

Be precise and clinical. No personality or emotion — just facts.`,
        },
        { type: "image", image: imageData },
      ],
    }],
  });

  // Step 2: Save scan to DB
  if (scanResult.output) {
    await insertScan({
      userId,
      imageUrl,
      scanType: "face",
      results: scanResult.output as Record<string, unknown>,
      cycleDay,
      cyclePhase,
    });
  }

  // Step 3: Compare with previous scan
  let comparisonBlock = "";
  if (scanResult.output && recentScans.length > 0) {
    const previousScan = recentScans[0];
    const comparison = compareScans(
      { results: previousScan.results as Record<string, unknown>, createdAt: previousScan.createdAt },
      { results: scanResult.output as Record<string, unknown>, createdAt: new Date() },
    );
    if (comparison) {
      comparisonBlock = comparison.summary;
    }
  }

  return {
    scanResult: scanResult.output ?? null,
    comparisonBlock,
    cycleContext,
  };
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/ai/scan-pipeline.ts
git commit -m "feat(5A): create shared scan pipeline module"
```

---

## Task 2: Refactor Telegram handler to use shared pipeline

**Files:**
- Modify: `src/lib/telegram/handler.ts:104-242`

Replace the inline scan logic with a call to `runScanPipeline()`.

- [ ] **Step 1: Update Telegram handler**

In `src/lib/telegram/handler.ts`, replace the photo handling block (from `// ---- PHOTO PATH` through the Gemini Vision call, scan saving, and comparison logic) with:

```typescript
import { runScanPipeline } from "@/lib/ai/scan-pipeline";
```

Then in the photo path section, replace lines ~108-242 with:

```typescript
if (msg.photo && msg.photo.length > 0) {
  const largestPhoto = msg.photo[msg.photo.length - 1];
  const photoBuffer = await tg.downloadFile(largestPhoto.file_id);

  // Upload to Vercel Blob
  const blob = await put(
    `telegram-photos/${dbUser.id}/${Date.now()}.jpg`,
    photoBuffer,
    { access: "public", contentType: "image/jpeg" },
  );

  await tg.sendChatAction(chatId);

  // Run shared scan pipeline
  const imageBase64 = photoBuffer.toString("base64");
  const { scanResult, comparisonBlock, cycleContext } = await runScanPipeline({
    imageData: imageBase64,
    userId: dbUser.id,
    imageUrl: blob.url,
  });

  // Ruhi interprets the scan results
  let responseText: string;
  if (scanResult) {
    const scanData = JSON.stringify(scanResult, null, 2);
    const photoMemoriesBlock = await loadAndFormatMemories(dbUser.id);

    const interpretation = await generateText({
      model: getLanguageModel(DEFAULT_CHAT_MODEL),
      system: buildRuhiSystemPrompt(cycleContext, photoMemoriesBlock ?? undefined),
      messages: [{
        role: "user",
        content: `Here are my skin scan results. Interpret them for me in your style — what's good, what needs attention, and what should I do:\n\n${scanData}${comparisonBlock ? `\n\n${comparisonBlock}` : ""}`,
      }],
    });

    responseText = interpretation.text || "Scan ho gaya, but summary generate nahi ho payi. Thodi der mein try karo.";
  } else {
    responseText = "Sorry yaar, photo analyze nahi ho payi. Clear selfie bhejo with good lighting!";
  }

  await saveTelegramMessage({ telegramChatId: chatId, role: "user", content: userText || "Sent a selfie for skin analysis" });
  await saveTelegramMessage({ telegramChatId: chatId, role: "assistant", content: responseText });
  await tg.sendMessage(chatId, responseText);
  return;
}
```

Remove the now-unused imports that were only needed for the inline scan logic (the `z`, `Output`, `calculateCyclePhase`, `compareScans`, `getLatestCycle`, `getRecentScans`, `insertScan`, `VISION_MODEL` imports — keep only what's still used by the text path or the refactored photo path).

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/telegram/handler.ts
git commit -m "refactor(5A): Telegram handler uses shared scan pipeline"
```

---

## Task 3: Client-side image resize utility

**Files:**
- Create: `src/lib/image-utils.ts`

- [ ] **Step 1: Create the resize utility**

```typescript
// src/lib/image-utils.ts

const MAX_DIMENSION = 1024;
const JPEG_QUALITY = 0.85;

/**
 * Resize an image file client-side using HTML canvas.
 * Returns a new File object (JPEG, max 1024px, 85% quality).
 */
export async function resizeImageFile(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;

      // Only resize if larger than max dimension
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        if (width > height) {
          height = Math.round((height * MAX_DIMENSION) / width);
          width = MAX_DIMENSION;
        } else {
          width = Math.round((width * MAX_DIMENSION) / height);
          height = MAX_DIMENSION;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas context not available"));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Canvas toBlob failed"));
            return;
          }
          const resizedFile = new File([blob], file.name.replace(/\.\w+$/, ".jpg"), {
            type: "image/jpeg",
          });
          resolve(resizedFile);
        },
        "image/jpeg",
        JPEG_QUALITY,
      );
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = URL.createObjectURL(file);
  });
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/image-utils.ts
git commit -m "feat(5A): add client-side image resize utility"
```

---

## Task 4: Update MultimodalInput — file input, resize, drag-and-drop

**Files:**
- Modify: `src/components/chat/multimodal-input.tsx`

Three changes: (a) add `accept`/`capture` to file input, (b) resize images before upload, (c) add drag-and-drop, (d) fix send button to allow image-only sends.

- [ ] **Step 1: Add import for resizeImageFile**

At the top of `multimodal-input.tsx`:

```typescript
import { resizeImageFile } from "@/lib/image-utils";
```

- [ ] **Step 2: Update file input element**

Change the hidden file input (around line 441-448):

```tsx
// CHANGE this:
<input
  className="pointer-events-none fixed -top-4 -left-4 size-0.5 opacity-0"
  multiple
  onChange={handleFileChange}
  ref={fileInputRef}
  tabIndex={-1}
  type="file"
/>

// TO this:
<input
  accept="image/*"
  capture="user"
  className="pointer-events-none fixed -top-4 -left-4 size-0.5 opacity-0"
  onChange={handleFileChange}
  ref={fileInputRef}
  tabIndex={-1}
  type="file"
/>
```

Note: removed `multiple` (single photo per message per spec) and added `accept="image/*"` and `capture="user"`.

- [ ] **Step 3: Add resize to uploadFile**

Update the `uploadFile` function (around line 299) to resize images before uploading:

```typescript
const uploadFile = useCallback(async (file: File) => {
  // Resize images client-side before upload
  let fileToUpload = file;
  if (file.type.startsWith("image/")) {
    try {
      fileToUpload = await resizeImageFile(file);
    } catch (err) {
      console.error("Image resize failed, uploading original:", err);
    }
  }

  const formData = new FormData();
  formData.append("file", fileToUpload);

  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/files/upload`,
      {
        method: "POST",
        body: formData,
      }
    );

    if (response.ok) {
      const data = await response.json();
      const { url, pathname, contentType } = data;

      return {
        url,
        name: pathname,
        contentType: contentType || "image/jpeg",
      };
    }
    const { error } = await response.json();
    toast.error(error);
  } catch (_error) {
    toast.error("Failed to upload file, please try again!");
  }
}, []);
```

- [ ] **Step 4: Add drag-and-drop handler**

Add a drag-and-drop state and handlers inside `PureMultimodalInput`, after the `handlePaste` effect (around line 409):

```typescript
const [isDragging, setIsDragging] = useState(false);

const handleDragOver = useCallback((e: React.DragEvent) => {
  e.preventDefault();
  e.stopPropagation();
  setIsDragging(true);
}, []);

const handleDragLeave = useCallback((e: React.DragEvent) => {
  e.preventDefault();
  e.stopPropagation();
  setIsDragging(false);
}, []);

const handleDrop = useCallback(
  async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files).filter((f) =>
      f.type.startsWith("image/")
    );
    if (files.length === 0) return;

    // Only take first image (single photo per message)
    const file = files[0];
    setUploadQueue([file.name]);

    try {
      const uploaded = await uploadFile(file);
      if (uploaded) {
        setAttachments((curr) => [...curr, uploaded]);
      }
    } catch {
      toast.error("Failed to upload dropped image");
    } finally {
      setUploadQueue([]);
    }
  },
  [uploadFile, setAttachments]
);
```

Then wrap the outermost `<div>` of the return with drag handlers:

```tsx
// CHANGE the outermost div:
<div className={cn("relative flex w-full flex-col gap-4", className)}>

// TO:
<div
  className={cn(
    "relative flex w-full flex-col gap-4",
    isDragging && "ring-2 ring-primary/50 rounded-2xl",
    className
  )}
  onDragLeave={handleDragLeave}
  onDragOver={handleDragOver}
  onDrop={handleDrop}
>
```

- [ ] **Step 5: Fix send button to allow image-only sends**

The submit button is currently disabled when `!input.trim()`. Change it to also allow sending when attachments exist:

```tsx
// CHANGE this (around line 582):
disabled={!input.trim() || uploadQueue.length > 0}

// TO:
disabled={(!input.trim() && attachments.length === 0) || uploadQueue.length > 0}
```

Also update the button styling condition:

```tsx
// CHANGE this (around line 577):
input.trim()
  ? "bg-foreground text-background hover:opacity-85 active:scale-95"
  : "bg-muted text-muted-foreground/25 cursor-not-allowed"

// TO:
(input.trim() || attachments.length > 0)
  ? "bg-foreground text-background hover:opacity-85 active:scale-95"
  : "bg-muted text-muted-foreground/25 cursor-not-allowed"
```

And update `submitForm` to allow empty text with attachments:

```tsx
// In the PromptInput onSubmit (around line 472), CHANGE:
if (!input.trim() && attachments.length === 0) {

// This is already correct — it checks both. No change needed here.
```

- [ ] **Step 6: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 7: Commit**

```bash
git add src/components/chat/multimodal-input.tsx
git commit -m "feat(5A): add image capture, resize, drag-and-drop to chat input"
```

---

## Task 5: Update upload route to organize web photos

**Files:**
- Modify: `src/app/(chat)/api/files/upload/route.ts`

- [ ] **Step 1: Update upload path to include userId**

Change the `put()` call to organize by user:

```typescript
// CHANGE this (around line 59):
const data = await put(`${safeName}`, fileBuffer, {
  access: "public",
});

// TO this:
const data = await put(`web-photos/${session.user.id}/${Date.now()}-${safeName}`, fileBuffer, {
  access: "public",
});
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add src/app/(chat)/api/files/upload/route.ts
git commit -m "feat(5A): organize web uploads under user-specific paths"
```

---

## Task 6: Add scan pipeline branch to web chat route

**Files:**
- Modify: `src/app/(chat)/api/chat/route.ts`

This is the core server-side change — detect image attachments and route through the scan pipeline.

- [ ] **Step 1: Add imports**

At the top of `route.ts`, add:

```typescript
import { runScanPipeline } from "@/lib/ai/scan-pipeline";
import { buildRuhiSystemPrompt } from "@/lib/ai/prompts";
```

Note: `buildRuhiSystemPrompt` should already be imported from Task 1 (Sprint 4E).

- [ ] **Step 2: Add image detection and scan pipeline in the execute block**

In the `execute` callback of `createUIMessageStream`, before the agent is created (around the `const agent = createChatAgent(...)` line), add image detection:

```typescript
execute: async ({ writer: dataStream }) => {
  // Check for image attachments in the latest user message
  const lastUserMessage = uiMessages.filter(m => m.role === "user").pop();
  const imageParts = lastUserMessage?.parts?.filter(
    (p: any) => p.type === "file" && p.mediaType?.startsWith("image/")
  ) ?? [];

  let scanContext = "";

  if (imageParts.length > 0) {
    // Fetch the image from Blob URL and convert to base64
    const imageUrl = (imageParts[0] as any).url;
    try {
      const imageResponse = await fetch(imageUrl);
      const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
      const imageBase64 = imageBuffer.toString("base64");

      const { scanResult, comparisonBlock, cycleContext } = await runScanPipeline({
        imageData: imageBase64,
        userId: session.user.id,
        imageUrl,
      });

      if (scanResult) {
        const scanData = JSON.stringify(scanResult, null, 2);
        scanContext = `Here are the clinical skin scan results for the photo the user just sent. Interpret them in your style — what's good, what needs attention, and what should they do:\n\n${scanData}`;
        if (comparisonBlock) {
          scanContext += `\n\n${comparisonBlock}`;
        }
      }
    } catch (err) {
      console.error("[ScanPipeline] Web chat scan failed:", err);
    }
  }

  // If we have scan results, inject them as additional context
  const agentMessages = scanContext
    ? [
        ...modelMessages.slice(0, -1),
        {
          role: "user" as const,
          content: [
            ...(modelMessages[modelMessages.length - 1] as any).content ?? [],
            { type: "text" as const, text: scanContext },
          ],
        },
      ]
    : modelMessages;

  const agent = createChatAgent({
    ...cfg,
    tools: ruhiTools,
  });

  const result = await agent.stream({ messages: agentMessages });
  dataStream.merge(
    result.toUIMessageStream({ sendReasoning: isReasoningModel })
  );

  // ... rest of the execute block stays the same
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 4: Commit**

```bash
git add src/app/(chat)/api/chat/route.ts
git commit -m "feat(5A): add scan pipeline branch for image attachments in web chat"
```

---

## Task 7: Manual smoke test

- [ ] **Step 1: Start dev server**

Run: `npm run dev`

- [ ] **Step 2: Test image button**

Click the attachment button in the chat input. Verify:
- File picker opens with image filter
- On mobile: camera option appears (if testing on mobile)
- Selected image shows as preview thumbnail
- Send button enables with image-only (no text needed)

- [ ] **Step 3: Test drag-and-drop**

Drag an image file onto the chat input area. Verify:
- Drop zone highlights (ring indicator)
- Image uploads and shows preview

- [ ] **Step 4: Test scan analysis**

Send a selfie photo. Verify:
- Ruhi responds with skin analysis in Hinglish voice
- Server logs show scan pipeline running
- Check DB: new row in `scans` table with zone data

- [ ] **Step 5: Test scan comparison**

Send a second selfie. Verify:
- Ruhi's response includes comparison with previous scan
- References improvements or changes from last scan

- [ ] **Step 6: Verify Telegram still works**

Send a photo to Ruhi on Telegram. Verify:
- Still works correctly after the refactor to shared pipeline
- Same quality of response as before
