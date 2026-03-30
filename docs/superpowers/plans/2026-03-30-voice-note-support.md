# Voice Note Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users send voice notes on Instagram and Telegram — Noor transcribes them via OpenAI Whisper and responds as if the user typed.

**Architecture:** One shared `transcribeAudio()` function in `src/lib/ai/transcribe.ts` calls the Whisper API via raw `fetch`. Each platform handler adds ~15 lines to detect audio, download, transcribe, and feed the text into the existing pipeline. No new dependencies.

**Tech Stack:** OpenAI Whisper API (`whisper-1`), existing `OPENAI_API_KEY`, raw `fetch` + `FormData`

**Spec:** `docs/superpowers/specs/2026-03-30-voice-note-support-design.md`

---

### Task 1: Shared transcription utility — test

**Files:**
- Create: `src/__tests__/transcribe.test.ts`

- [ ] **Step 1: Write the test file**

This test mocks `global.fetch` to simulate the Whisper API and verifies the `transcribeAudio` function handles success, failure, empty results, and oversized files.

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({
  env: { OPENAI_API_KEY: "test-key-123" },
}));

import { transcribeAudio } from "@/lib/ai/transcribe";

describe("transcribeAudio", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("returns transcribed text on success", async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({ text: "hello yaar kaise ho" }),
    };
    vi.mocked(global.fetch).mockResolvedValue(mockResponse as Response);

    const result = await transcribeAudio(Buffer.from("fake-audio"));
    expect(result).toBe("hello yaar kaise ho");
  });

  it("sends correct multipart form data to Whisper API", async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({ text: "test" }),
    };
    vi.mocked(global.fetch).mockResolvedValue(mockResponse as Response);

    await transcribeAudio(Buffer.from("audio-data"), "audio/ogg");

    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.openai.com/v1/audio/transcriptions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-key-123",
        }),
      }),
    );
  });

  it("returns null when API returns error", async () => {
    const mockResponse = {
      ok: false,
      status: 500,
      text: async () => "Internal Server Error",
    };
    vi.mocked(global.fetch).mockResolvedValue(mockResponse as Response);

    const result = await transcribeAudio(Buffer.from("fake-audio"));
    expect(result).toBeNull();
  });

  it("returns null when transcription is empty", async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({ text: "" }),
    };
    vi.mocked(global.fetch).mockResolvedValue(mockResponse as Response);

    const result = await transcribeAudio(Buffer.from("fake-audio"));
    expect(result).toBeNull();
  });

  it("returns null when transcription is whitespace only", async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({ text: "   " }),
    };
    vi.mocked(global.fetch).mockResolvedValue(mockResponse as Response);

    const result = await transcribeAudio(Buffer.from("fake-audio"));
    expect(result).toBeNull();
  });

  it("returns null for oversized buffers (>25MB)", async () => {
    // Create a buffer just over 25MB
    const oversized = Buffer.alloc(25 * 1024 * 1024 + 1);
    const result = await transcribeAudio(oversized);
    expect(result).toBeNull();
    // Should NOT have called fetch
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns null when fetch throws a network error", async () => {
    vi.mocked(global.fetch).mockRejectedValue(new Error("network down"));

    const result = await transcribeAudio(Buffer.from("fake-audio"));
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test:unit -- src/__tests__/transcribe.test.ts`

Expected: FAIL — `Cannot find module '@/lib/ai/transcribe'` because the implementation doesn't exist yet.

---

### Task 2: Shared transcription utility — implementation

**Files:**
- Create: `src/lib/ai/transcribe.ts`

- [ ] **Step 1: Create the transcription utility**

```typescript
import "server-only";

import { env } from "@/lib/env";

const WHISPER_URL = "https://api.openai.com/v1/audio/transcriptions";
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB — Whisper API limit

/**
 * Transcribe an audio buffer to text using OpenAI Whisper.
 * Returns the transcribed text, or null on failure.
 */
export async function transcribeAudio(
  audioBuffer: Buffer,
  mimeType = "audio/ogg",
): Promise<string | null> {
  if (audioBuffer.length > MAX_FILE_SIZE) {
    console.warn("[Transcribe] File too large:", audioBuffer.length, "bytes");
    return null;
  }

  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn("[Transcribe] OPENAI_API_KEY not set, skipping transcription");
    return null;
  }

  try {
    const ext = mimeType === "audio/mp4" ? "m4a" : "ogg";
    const form = new FormData();
    form.append(
      "file",
      new Blob([audioBuffer], { type: mimeType }),
      `voice.${ext}`,
    );
    form.append("model", "whisper-1");

    const res = await fetch(WHISPER_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[Transcribe] Whisper API error:", res.status, errText);
      return null;
    }

    const data = (await res.json()) as { text: string };
    const text = data.text?.trim();

    if (!text) {
      console.warn("[Transcribe] Empty transcription result");
      return null;
    }

    return text;
  } catch (err: any) {
    console.error("[Transcribe] Failed:", err?.message || err);
    return null;
  }
}
```

- [ ] **Step 2: Run the tests to verify they pass**

Run: `pnpm test:unit -- src/__tests__/transcribe.test.ts`

Expected: All 7 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/ai/transcribe.ts src/__tests__/transcribe.test.ts
git commit -m "feat(noor): add shared voice note transcription utility (Whisper)"
```

---

### Task 3: Instagram voice note support

**Files:**
- Modify: `src/lib/instagram/handler.ts:93-115`

- [ ] **Step 1: Add audio detection in `processInstagramMessage()`**

In `src/lib/instagram/handler.ts`, add an import for `transcribeAudio` at the top (with the other imports):

```typescript
import { transcribeAudio } from "@/lib/ai/transcribe";
```

Then insert a new audio check block **after** the image attachment check (line 100, after the `if (imageAttachment)` block closes) and **before** the `if (msg.text)` check (line 102):

```typescript
    // Check for audio attachments (voice notes)
    const audioAttachment = msg.attachments?.find((a) => a.type === "audio");
    if (audioAttachment) {
      // ---- VOICE NOTE PATH ----
      try {
        console.log("[Noor/IG] Voice note received from:", senderId, "url:", audioAttachment.payload.url.substring(0, 60));
        const audioBuffer = await ig.downloadImage(audioAttachment.payload.url);
        console.log("[Noor/IG] Voice note downloaded, size:", audioBuffer.length, "bytes");
        const transcribedText = await transcribeAudio(audioBuffer, "audio/mp4");
        if (transcribedText) {
          console.log("[Noor/IG] Transcription result:", transcribedText.length, "chars");
          await handleTextMessage(ig, senderId, dbUser, transcribedText);
          return;
        }
      } catch (err: any) {
        console.error("[Noor/IG] Voice transcription error:", err?.message || err);
      }
      // Transcription failed or returned null
      await ig.sendMessage(senderId, "Yaar, voice note sun nahi payi. Dobara bhejo ya type kar do? 🎤");
      return;
    }
```

Also update the unsupported message fallback (line 112) to no longer mention audio:

```typescript
    // Unsupported message type (video, sticker, etc.)
    await ig.sendMessage(
      senderId,
      "Hey! Abhi mein sirf text, photos aur voice notes handle kar sakti hoon. Photo bhejo for skin analysis ya text mein kuch bhi poocho!",
    );
```

- [ ] **Step 2: Verify the build**

Run: `pnpm build`

Expected: Build succeeds with no type errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/instagram/handler.ts
git commit -m "feat(noor): add voice note support for Instagram DMs"
```

---

### Task 4: Telegram voice note support — type + detection

**Files:**
- Modify: `src/lib/telegram/handler.ts:75-106` (type), `src/lib/telegram/handler.ts:164-210` (handler)

- [ ] **Step 1: Add `voice` to the `TelegramUpdate` type**

In `src/lib/telegram/handler.ts`, add an import for `transcribeAudio` at the top:

```typescript
import { transcribeAudio } from "@/lib/ai/transcribe";
```

Then extend the `message` type in the `TelegramUpdate` interface. Add `voice` after the existing `caption` field (line 89):

```typescript
    voice?: { file_id: string; file_unique_id: string; duration: number; mime_type?: string; file_size?: number };
```

- [ ] **Step 2: Add voice transcription before the onboarding check**

In `processTelegramUpdate()`, add a voice transcription block **after** user upsert (line 181, after `const dbUser = ...`) and **before** the onboarding check (line 183, `// --- Check mid-onboarding state ---`).

The goal: if the message is a voice note, transcribe it into `userText` so that everything downstream (onboarding, photo path, text path) sees regular text.

```typescript
    // --- Transcribe voice notes to text ---
    let voiceTranscribedText: string | undefined;
    if (msg.voice) {
      try {
        console.log("[Noor/TG] Voice note received, chat:", chatId, "duration:", msg.voice.duration, "s");
        const voiceBuffer = await tg.downloadFile(msg.voice.file_id);
        console.log("[Noor/TG] Voice note downloaded, size:", voiceBuffer.length, "bytes");
        const transcribed = await transcribeAudio(voiceBuffer, msg.voice.mime_type ?? "audio/ogg");
        if (transcribed) {
          console.log("[Noor/TG] Transcription result:", transcribed.length, "chars");
          voiceTranscribedText = transcribed;
        } else {
          await tg.sendMessage(chatId, "Yaar, voice note sun nahi payi. Dobara bhejo ya type kar do? 🎤");
          return;
        }
      } catch (err: any) {
        console.error("[Noor/TG] Voice transcription error:", err?.message || err);
        await tg.sendMessage(chatId, "Yaar, voice note sun nahi payi. Dobara bhejo ya type kar do? 🎤");
        return;
      }
    }
```

- [ ] **Step 3: Wire transcribed text into onboarding check**

The mid-onboarding check (line 190-192) currently uses `msg.text ?? msg.caption ?? ""`. Update it to prefer the transcribed voice text:

Change line 192 from:
```typescript
        text: msg.text ?? msg.caption ?? "",
```
to:
```typescript
        text: voiceTranscribedText ?? msg.text ?? msg.caption ?? "",
```

- [ ] **Step 4: Wire transcribed text into the skipped-user analysis check**

The "skipped user requests skin analysis" block (line 200) reads `msg.text ?? msg.caption ?? ""`. Update it:

Change line 200 from:
```typescript
      const userText = (msg.text ?? msg.caption ?? "").toLowerCase();
```
to:
```typescript
      const userText = (voiceTranscribedText ?? msg.text ?? msg.caption ?? "").toLowerCase();
```

- [ ] **Step 5: Wire transcribed text into the main userText variable**

The text path (line 209) sets `let userText = msg.text ?? msg.caption ?? ""`. Update it:

Change line 209 from:
```typescript
    let userText = msg.text ?? msg.caption ?? "";
```
to:
```typescript
    let userText = voiceTranscribedText ?? msg.text ?? msg.caption ?? "";
```

- [ ] **Step 6: Verify the build**

Run: `pnpm build`

Expected: Build succeeds with no type errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/telegram/handler.ts
git commit -m "feat(noor): add voice note support for Telegram"
```

---

### Task 5: Run all tests

**Files:** None (verification only)

- [ ] **Step 1: Run the full unit test suite**

Run: `pnpm test:unit`

Expected: All tests pass, including the new `transcribe.test.ts`.

- [ ] **Step 2: Run the build**

Run: `pnpm build`

Expected: Build succeeds.
