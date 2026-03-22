# Photo Upload from Web Chat — Sprint 5A Design Spec

**Date:** 2026-03-21
**Status:** Approved
**Scope:** Photo upload in web chat with skin scan analysis, client-side resize, drag-and-drop, and camera capture

---

## Problem

Web chat users can talk to Ruhi but can't send selfies for skin analysis. Telegram users can send photos and get zone-by-zone scan analysis with comparison to previous scans. Web users are missing this core feature.

## Goal

Users can send a photo in the web chat (via button, drag-and-drop, or mobile camera) and receive Ruhi's skin analysis with the same quality as Telegram — Gemini Vision analysis, scan comparison, cycle-aware advice, all in Ruhi's voice.

---

## Design Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Upload UX | Image button + drag-and-drop + camera capture | Standard modern chat UX, covers all devices |
| Image processing | Client-side resize to max 1024px | Fast uploads, lower storage costs, sufficient for skin analysis |
| Storage | Vercel Blob (`web-photos/{userId}/{timestamp}.jpg`) | Consistent with Telegram pattern, enables future photo history |
| Scan pipeline | Shared module used by both Telegram and web | DRY — both paths use identical Vision + compare + save logic |
| Analysis flow | Inline in chat stream | Matches Telegram UX — user sends photo, gets streaming Ruhi response |
| Camera capture | `capture="user"` on file input | Native front camera on mobile, falls back to file picker on desktop |
| Multiple photos | Single photo per message | Keep it simple; multiple photo support deferred |

---

## What Changes

### 1. Client-Side: Image Upload in MultimodalInput

**Add to `src/components/chat/multimodal-input.tsx`:**
- Image button (camera/image icon) next to the message input
- Hidden file input with `accept="image/*" capture="user"`
- Drag-and-drop handler on the chat input area
- Client-side resize using HTML canvas (max 1024px width/height, preserve aspect ratio)
- Preview thumbnail shown as an attachment chip (existing `attachments` state + `PreviewAttachment` component)
- On send: image included as base64 data URL in the message's `attachments` array

**Resize logic:**
- Load image into an `Image` element
- If width or height > 1024px, scale down proportionally
- Draw onto a canvas, export as JPEG at 85% quality
- Convert to base64 data URL

### 2. Server-Side: Scan Pipeline Branch in Chat Route

**Modify `src/app/(chat)/api/chat/route.ts`:**

In the `execute` callback of `createUIMessageStream`, before running the agent:
1. Check if the user's message has image attachments
2. If image present → call shared scan pipeline:
   - Upload to Vercel Blob
   - Run Gemini Vision structured analysis
   - Fetch previous scans + run `compareScans()` if history exists
   - Get cycle context if available
   - Inject scan results + comparison as a synthetic user message for Ruhi to interpret
3. Let the Ruhi agent stream its interpretation response
4. Save scan record to `scans` table
5. If no image → normal text chat flow (existing 4E behavior)

### 3. Shared Scan Pipeline Module

**Create `src/lib/ai/scan-pipeline.ts`:**

Extract the following logic from `src/lib/telegram/handler.ts` into a shared module:
- Gemini Vision call with the `scanSchema` zod object
- Scan comparison via `compareScans()`
- Scan saving via `insertScan()`
- Cycle context fetching via `getLatestCycle()` + `calculateCyclePhase()`

Interface:
```typescript
export async function runScanPipeline(options: {
  imageData: Buffer | string;  // Buffer for Telegram, base64 string for web
  userId: string;
  imageUrl: string;            // Blob URL after upload
}): Promise<{
  scanResult: ScanOutput | null;
  comparisonBlock: string;
  cycleContext: string;
}>
```

Both Telegram handler and web chat route call this function. Telegram passes a Buffer (from downloading the photo), web passes a base64 string (from the attachment). The function handles both.

### 4. Refactor Telegram Handler

**Modify `src/lib/telegram/handler.ts`:**

Replace the inline scan logic (~lines 104-242) with a call to `runScanPipeline()`. The handler still:
- Downloads the photo from Telegram
- Uploads to Vercel Blob
- Calls `runScanPipeline()`
- Builds the Ruhi interpretation prompt
- Sends the response

But the Vision call, comparison, and scan saving are now in the shared module.

---

## Files to Modify

### New files
- `src/lib/ai/scan-pipeline.ts` — shared scan analysis pipeline

### Modified files
- `src/app/(chat)/api/chat/route.ts` — add image detection + scan pipeline branch
- `src/components/chat/multimodal-input.tsx` — add image button, drag-and-drop, resize, camera capture
- `src/lib/telegram/handler.ts` — refactor to use shared scan-pipeline

### Unchanged
- Auth system — works as-is
- Database schema — `scans` table already exists with the right schema
- Memory system — already integrated in 4E
- Scan comparison (`src/lib/scan/comparator.ts`) — called by the new shared pipeline
- Gemini Vision model config — already in `models.ts` as `VISION_MODEL`

---

## Data Flow

1. **User selects photo** → browser resizes to max 1024px → base64 data URL
2. **User sends message** → `POST /api/chat` with `attachments: [{ contentType: "image/jpeg", url: "data:image/jpeg;base64,..." }]`
3. **Route detects image** → uploads to Vercel Blob → calls `runScanPipeline()`
4. **Scan pipeline** → Gemini Vision → structured scan data → compare with previous → get cycle context
5. **Route injects scan data** into Ruhi agent message → agent streams interpretation
6. **onFinish** → scan record saved to DB, safety net runs on any text

---

## Scope Boundaries

**In scope (Sprint 5A):**
- Image button with camera capture (`capture="user"`)
- Drag-and-drop photo upload
- Client-side resize (max 1024px, JPEG 85%)
- Vercel Blob storage
- Gemini Vision scan analysis (shared pipeline)
- Scan comparison with previous scans
- Streaming Ruhi interpretation
- Scan saved to `scans` table
- Refactor Telegram handler to use shared pipeline

**Out of scope:**
- Multiple photos per message
- Photo history viewer UI
- Video upload
- Before/after photo comparison UI
- Mobile-optimized camera overlay
