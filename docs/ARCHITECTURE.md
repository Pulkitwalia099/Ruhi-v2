---
path: docs/ARCHITECTURE.md
outline: |
  • Architecture                               L17
    ◦ Directory Structure                      L25
    ◦ Core Systems                             L55
      ▪ AI Layer (src/lib/ai/)                 L57
      ▪ Memory System (src/lib/memory/)        L75
      ▪ Proactive Messaging (src/lib/proactive/) L90
      ▪ Scan Comparison (src/lib/scan/)        L105
      ▪ Artifacts (src/artifacts/)             L112
      ▪ Database (src/lib/db/)                 L120
      ▪ Authentication (src/lib/auth.ts)       L148
      ▪ Middleware (src/proxy.ts)              L156
    ◦ Data Flow                               L165
    ◦ Key Dependencies                        L180
    ◦ Infrastructure                          L192
---

# Architecture

Last updated: `2026.03.22`

> Next.js 16 skincare companion (Ruhi) with Telegram bot, multi-model AI, memory system, proactive messaging, and scan comparison.

---

## Directory Structure

```
src/
├── app/              # Next.js App Router (routes, layouts, API handlers)
│   ├── (auth)/       # Login, register, guest auth, BetterAuth config
│   ├── (chat)/       # Chat UI, API routes (chat, history, models, vote, documents)
│   └── api/cron/     # Cron jobs (cleanup-memories, proactive-ruhi)
├── artifacts/        # Artifact type handlers (text, code, sheet, image)
├── components/
│   ├── ai-elements/  # Model selector, prompt input, slash commands
│   ├── chat/         # Shell, sidebar, messages, editors, toolbar
│   └── ui/           # Radix-based primitives (shadcn)
├── hooks/            # React hooks (chat state, artifacts, auto-resume, scroll)
└── lib/
    ├── ai/           # Model registry, providers, prompts, tools
    │   └── tools/    # getCycleContext, logCycle, getScanHistory, saveMemory
    ├── db/           # Drizzle schema, queries, migrations
    ├── memory/       # Memory loader/formatter, post-hoc safety net
    ├── proactive/    # Product follow-ups, scan nudges, weather tips
    ├── scan/         # Scan comparator (zone-by-zone diff)
    ├── telegram/     # Telegram handler + client
    ├── artifacts/    # Artifact utilities
    └── editor/       # Prosemirror editor config
tests/                # Playwright e2e tests
scripts/              # Test utilities (memory system integration test)
content/              # ruhi-prompt.md (Ruhi v2.0 persona)
public/               # Static assets
```

---

## Core Systems

### AI Layer (`src/lib/ai/`)

Models are routed through a centralized `getLanguageModel()` function in `providers.ts`. On Vercel (when `VERCEL_OIDC_TOKEN` or `AI_GATEWAY_API_KEY` is set), requests route through the **Vercel AI Gateway** for cost tracking, failover, and observability. Locally, falls back to direct provider SDKs (`@ai-sdk/anthropic`, `@ai-sdk/google`) with API keys.

Default model: `anthropic/claude-haiku-4.5`. Vision model: `google/gemini-2.5-flash`. Model IDs use gateway format (dots for versions). `DIRECT_MODEL_MAP` in `models.ts` translates to API-specific IDs for the direct SDK fallback.

**Telegram Agent** (`runRuhiAgent`) uses `generateText()` with tools:
- `getCycleContext` — current menstrual cycle phase + skin implications
- `logCycle` — record period start
- `getScanHistory` — fetch recent skin scans
- `saveMemory` — persist user facts across conversations

**Web Chat Agent** (`createChatAgent`) uses `ToolLoopAgent` for streaming with artifact tools.

### Memory System (`src/lib/memory/`)

Cross-session memory so Ruhi remembers users between conversations.

- **5 categories:** identity (name, gender, skin_type, city...), health (products, symptoms), preference (budget, brands), moment (emotional events), context (temporary facts, 14-day expiry)
- **saveMemory tool:** LLM calls it mid-conversation to persist facts. Enum keys prevent hallucinated categories.
- **Auto-injected recall:** `loadAndFormatMemories()` fetches all memories, formats into a prompt block, injected before every LLM call (both text and photo paths)
- **Post-hoc safety net:** 5 regex patterns (skin type, name, city, gender, products) catch facts the LLM missed. Zero token cost.
- **Moment cap:** 30 entries max, oldest deleted via transactional `FOR UPDATE` lock
- **Expiry cron:** Daily at 3 AM UTC, deletes expired context memories

### Proactive Messaging (`src/lib/proactive/`)

Ruhi initiates conversations with three message types:

- **Product follow-up:** Day 3 + day 5 after recommending a product (status: "recommended" in health memories)
- **Scan nudge:** Day 4 + day 10 after last scan, referencing previous concerns
- **Weather tip:** Daily evaluation at 9 AM IST, sent only if notable change (humidity spike >20%, UV ≥8, extreme temp, poor AQI)

Global rules: inactive 48h+ → max 1/day; active → no cap. Quiet hours 9 AM - 9 PM IST. `/quiet` to pause, `/nudge` to resume. Natural language opt-out detection. LLM-generated messages personalized with user memories.

### Scan Comparison (`src/lib/scan/`)

When a user sends a new scan photo, the system automatically compares with their previous scan:

- Zone-by-zone severity deltas (6 zones: forehead, t-zone, cheeks, chin, jawline)
- Overall score trend (improved/worsened/stable)
- Formatted comparison summary injected into Claude's interpretation prompt
- Ruhi celebrates improvements and gently flags regressions

### Artifacts (`src/artifacts/`)

Four artifact types: **text**, **code**, **sheet**, **image**. Each type has:
- `server.ts` — document handler that streams creation/update via `dataStream`
- `client.tsx` — editor component (Prosemirror for text, CodeMirror for code, React Data Grid for sheets)

Streaming uses typed delta parts (`textDelta`, `codeDelta`, `sheetDelta`) pushed through the AI SDK's data stream protocol. Documents are versioned — each save creates a new row keyed by `(id, createdAt)`, enabling version navigation.

### Database (`src/lib/db/`)

**Drizzle ORM** with PostgreSQL (Neon). Key tables:

| Table | Purpose |
|---|---|
| `users` | User accounts with bcrypt passwords, `isAnonymous` flag, `telegramId` |
| `sessions` | BetterAuth session records (written on sign-in/out, cookie-cached) |
| `accounts` | Auth method links (email/password stored here by BetterAuth) |
| `verifications` | Email verification tokens (forward-looking, unused) |
| `chats` | Conversations with title, visibility (public/private) |
| `messages` | Messages with role, parts (JSON), attachments |
| `documents` | Artifact content, versioned by `(id, createdAt)` |
| `votes` | Per-message thumbs up/down |
| `suggestions` | Writing suggestions linked to documents |
| `streams` | Resumable stream metadata (Redis-backed) |
| `cycles` | Menstrual cycle data (periodStart, cycleLength) |
| `scans` | Face scan results (JSONB zones, overall_score, concerns) |
| `telegram_messages` | Plain text Telegram conversation history |
| `memories` | Cross-session user facts (5 categories, enum keys, expiry) |
| `proactive_log` | Tracks sent proactive messages (prevents duplicates) |

History uses cursor-based pagination (`startingAfter`/`endingBefore`).

### Authentication (`src/lib/auth.ts`)

**BetterAuth** with Drizzle adapter. Two auth methods:
1. **Email/password** — bcrypt hashing via `bcrypt-ts`, custom hash/verify for backward compatibility
2. **Anonymous** — auto-created guest users via the `anonymous` plugin (`guest-{timestamp}@anon.local`)

Sessions use cookie cache (no DB hit per request). The middleware (`src/proxy.ts`) checks for session cookies and redirects unauthenticated users to the guest flow. Server-side session access via `auth.api.getSession({ headers })`.

### Middleware (`src/proxy.ts`)

Edge middleware that runs on all non-static routes:
- `/ping` → health check
- `/api/auth/*` → passthrough
- No session cookie → redirect to `/api/auth/guest` (creates anonymous session)

Base-path aware for multi-tenant deployment (`IS_DEMO` env).

---

## Data Flow

### Telegram (primary)
1. **User sends text** → webhook → `processTelegramUpdate()` → load memories → load history (40 msgs) → `runRuhiAgent()` (with tools + memories) → save response → safety net → send reply
2. **User sends photo** → Gemini Vision analysis → fetch previous scan → `compareScans()` → Claude interprets with comparison + memories → save scan + response → send reply
3. **Proactive cron** (daily 9 AM IST) → check eligible users → product follow-ups / scan nudges / weather tips → LLM generates message → send via Telegram

### Web Chat
1. **User sends message** → `POST /api/chat` → `saveChat()` + `saveMessages()` → `streamText()` streams response
2. **Model calls tool** → tool handler executes (e.g., `createDocument`) → document handler streams deltas → `Document` row saved
3. **Stream interrupted** → `resumable-stream` persists to Redis → client reconnects via `/api/chat/[id]/stream` → resumes from last position

---

## Key Dependencies

| Category | Libraries |
|---|---|
| AI | `ai`, `@ai-sdk/react`, `@ai-sdk/gateway`, `@ai-sdk/anthropic`, `@ai-sdk/google` |
| Database | `drizzle-orm`, `postgres` |
| Auth | `better-auth`, `bcrypt-ts` |
| Editors | `prosemirror-*`, `codemirror`, `react-data-grid` |
| Rendering | `streamdown`, `shiki`, `katex` |
| UI | `radix-ui`, `lucide-react`, `tailwindcss` v4 |
| Infra | `@vercel/blob`, `@vercel/otel`, `redis` |

## Infrastructure

- **AI Gateway** — Vercel AI Gateway for cost tracking, failover, observability (OIDC auth)
- **Cron jobs** — Memory cleanup (daily 3 AM UTC), Proactive messaging (daily 9 AM IST)
- **Rate limiting** — Redis-based, 10 messages/IP/hour (production only)
- **Error handling** — Typed `ChatbotError` with codes, surfaces, and visibility rules
- **Observability** — OpenTelemetry via `@vercel/otel`, AI Gateway dashboard
- **Bot protection** — `botid` integration on `/api/chat`
- **Deployment** — Vercel, production via `vercel --prod` (repo uses `master` branch)
