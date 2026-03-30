# Voice Note Support for Noor — Design Spec

**Date:** 2026-03-30
**Status:** Approved
**Platforms:** Instagram DM + Telegram

## Problem

Users get tired of typing and want to send voice notes. Currently:
- Instagram: voice notes hit a catch-all that says "I only handle text and photos"
- Telegram: voice notes are silently ignored (no handler exists)

## Decision Summary

| Decision | Choice |
|---|---|
| Platforms | Both Instagram and Telegram |
| STT Engine | OpenAI Whisper API (`whisper-1`) |
| UX Style | Seamless — no acknowledgment, respond as if user typed |
| Failure Handling | Single attempt, friendly fallback message |
| Onboarding | Voice notes work everywhere, including mid-onboarding |

## Architecture

### Approach: Shared transcription utility, inline integration

One shared `transcribeAudio()` function. Each platform handler adds a small audio detection block that downloads, transcribes, and feeds the resulting text into the existing text pipeline. Everything downstream (onboarding, agent, safety net) is unchanged.

```
Voice note arrives
  → Platform detects audio (IG: attachment type "audio", TG: message.voice)
  → Download audio buffer (existing client methods)
  → transcribeAudio(buffer) → text | null
  → Success: feed text into existing handleTextMessage / text path
  → Failure: send friendly fallback, return
```

## Components

### 1. Shared Transcription Utility

**New file:** `src/lib/ai/transcribe.ts`

**Function:** `transcribeAudio(audioBuffer: Buffer, mimeType?: string): Promise<string | null>`

- Calls OpenAI Whisper API: `POST https://api.openai.com/v1/audio/transcriptions`
- Uses `multipart/form-data` with the audio buffer
- Model: `whisper-1` (auto-detects language — handles Hindi/English/Hinglish)
- Uses `OPENAI_API_KEY` from `env.ts` (already configured, no new env vars)
- No new npm dependencies — raw `fetch` + `FormData`
- File size guard: reject if buffer > 25MB (Whisper limit), return `null`
- On API error or empty transcription: log error, return `null`

### 2. Instagram Handler Changes

**File:** `src/lib/instagram/handler.ts` — `processInstagramMessage()`

- Add audio attachment check **after** the image check (line 96) and **before** the text check (line 102)
- Detect: `msg.attachments?.find(a => a.type === "audio")`
- Download audio from `attachment.payload.url` (reuse `ig.downloadImage()` — it's a generic URL fetcher)
- Call `transcribeAudio(audioBuffer)`
- Success: call `handleTextMessage(ig, senderId, dbUser, transcribedText)`
- Failure: send fallback message: "Yaar, voice note sun nahi payi. Dobara bhejo ya type kar do?"
- The "unsupported message type" catch-all (line 112) remains for video, stickers, files

### 3. Telegram Handler Changes

**File:** `src/lib/telegram/handler.ts`

**Type change:** Add `voice` field to `TelegramUpdate.message`:
```typescript
voice?: {
  file_id: string;
  file_unique_id: string;
  duration: number;
  mime_type?: string;
  file_size?: number;
}
```

**Handler change in `processTelegramUpdate()`:**

- Add voice detection **after** user upsert (line 178) and **before** the onboarding check (line 184)
- Detect: `msg.voice` exists
- Download via `tg.downloadFile(msg.voice.file_id)` (already works for any file type)
- Call `transcribeAudio(voiceBuffer)`
- Success: set `userText` to transcribed text, then fall through into the existing flow — the onboarding check and text path both use `userText`, so they work unchanged
- Failure: send fallback message, return early

**Important:** Transcription must happen early — before the mid-onboarding check — so the onboarding state machine receives the transcribed text just like typed text. The voice check replaces the empty string that `msg.text` would produce for a voice-only message.

### 4. Telegram `audio` vs `voice`

- `voice` = voice notes recorded in-app (OGG/Opus) — handled
- `audio` = audio files sent as attachments (MP3, etc.) — NOT handled in this iteration
- Can add `audio` support later if needed

## Edge Cases

1. **File size > 25MB:** Return `null`, send fallback. Extremely unlikely for voice notes (~100-300KB per minute).
2. **Instagram music/audio shares:** Treated the same as voice — transcribe whatever we get. If it's a song, Whisper transcribes lyrics and Noor responds naturally.
3. **Empty transcription:** Whisper returns empty string for silence or pure noise — treated as failure, send fallback.
4. **API key missing:** `OPENAI_API_KEY` is already optional in env.ts. If missing, `transcribeAudio` returns `null` and user gets fallback message.

## Logging

Follow existing patterns:
- `[Noor/IG] Voice note received from: {senderId}, size: {bytes}`
- `[Noor/IG] Transcription result: {length} chars`
- `[Noor/IG] Transcription FAILED: {error}`
- Same pattern with `[Noor/TG]` prefix for Telegram

## Cost

- Whisper: ~$0.006/minute of audio
- Typical voice note (15-30 seconds): $0.001-0.003 per message
- Negligible compared to existing Claude/Gemini costs per conversation

## Files Changed

| File | Change |
|---|---|
| `src/lib/ai/transcribe.ts` | **New** — shared transcription utility |
| `src/lib/instagram/handler.ts` | Add audio detection block (~15 lines) |
| `src/lib/telegram/handler.ts` | Add voice type + detection block (~20 lines) |

## Not In Scope

- Video message transcription
- Telegram `audio` file type (MP3 attachments)
- Voice response from Noor (TTS)
- Transcription caching
