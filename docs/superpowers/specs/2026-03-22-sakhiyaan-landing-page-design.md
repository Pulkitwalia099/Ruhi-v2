# Sakhiyaan Landing Page — Design Spec

**Date:** 2026-03-22
**Status:** Approved
**Approach:** Static landing page with animated chat preview (Approach B)

---

## Overview

A public marketing landing page for Sakhiyaan — a holistic women's health AI companion platform. The page drives users to **chat with Noor on Telegram** (primary CTA) and offers a **web chat demo** as a secondary entry point. Only Noor (Skin Architect) is live; Ruhi and Saahi are marked "Coming Soon."

### Goals

- Convert visitors into Telegram users chatting with Noor
- Communicate the "interconnected care" value proposition
- Showcase Noor's personality through an animated Hinglish chat preview
- Build anticipation for Ruhi (Health) and Saahi (Mood)

### Audience

Indian women (18-35). Tone is bilingual — English-first with Hinglish sprinkled in naturally, matching how Noor speaks.

### Non-Goals

- No auth/login on the landing page itself
- No live chat demo (deferred — would need rate limiting and abuse protection)
- No dashboard or logged-in experience (separate future work)

---

## Tech Stack

- **Framework:** Next.js App Router (existing project)
- **Route:** `/` (replaces or wraps existing home route)
- **Rendering:** Server Component for the page, Client Component for the animated chat preview only
- **Styling:** Tailwind CSS with the existing Sakhiyaan design system tokens
- **Fonts:** Plus Jakarta Sans (headlines), Be Vietnam Pro (body) — from Stitch design system
- **Env vars:** `NEXT_PUBLIC_TELEGRAM_BOT_URL` — Telegram bot deep link (`https://t.me/Ruhi_Sahki_Bot`)
- **No additional dependencies** beyond what's already installed

---

## Design System

Follows the Stitch project "Noor's Hub (Health)" design system. Key tokens:

### Colors
| Token | Value | Usage |
|-------|-------|-------|
| `background` | `#FFF8F5` | Warm cream canvas (primary bg) |
| `surface-container-low` | `#F9F2EF` | Section alternating bg |
| `on-background` | `#2D1810` | Deep brown text (never pure black) |
| `on-surface-variant` | `#584140` | Secondary text |
| `outline` | `#8c706f` | Muted text |
| `primary` | `#AE2F34` | Deep coral (Ruhi's color) |
| `primary-container` | `#FF6B6B` | Light coral (CTAs, gradients) |
| `secondary` | `#006A65` | Deep teal (Noor's color) |
| `secondary-container` | `#4ECDC4` | Light teal |
| `tertiary` | `#655975` | Deep lavender (Saahi's color) |
| `tertiary-container` | `#A495B4` | Light lavender |
| `gold-accent` | `#D4A574` | Warm gold for emphasis |

### Typography
- Headlines: Plus Jakarta Sans, 700-800 weight, tight letter-spacing (-0.02em to -0.03em)
- Body: Be Vietnam Pro, 400-500 weight, generous line-height (1.5-1.7)
- Display sizes: 3.2rem (hero h1), 2.2rem (section h2), 1.3rem (card h3)

### Components
- **Border radius:** Always `2rem` (cards) or `999px` (pills/buttons). Never sharp corners.
- **Shadows:** Soft ambient only — `0 24px 48px rgba(29,27,26,0.06)`. No hard drop shadows.
- **No borders:** Use background color shifts between sections, never 1px solid borders.
- **Glassmorphic cards:** White bg with subtle box-shadow on cream canvas.
- **CTA buttons:** Primary = gradient `#AE2F34` → `#FF6B6B`, pill shape, white text. Secondary = `rgba(232,225,222,0.6)` with backdrop-blur.

---

## Page Sections

### 1. Navigation Bar

Sticky top nav with:
- Left: "Sakhiyaan" wordmark (Plus Jakarta Sans, 700)
- Right: "About" | "Meet Noor" anchor links + "Chat on Telegram" primary CTA button
- Transparent on cream background, no bottom border
- Mobile: hamburger menu

### 2. Hero Section

**Layout:** Two-column grid (text left, chat preview right). On mobile, stacks vertically.

**Left column:**
- "Introducing Sakhiyaan" pill badge (teal tint background, teal text)
- Headline: "Meet the **truly yours** for your Skin, Health, and Mood." — "truly yours" in coral
- Subtext: "Your circle of companions — guided by science, rooted in empathy. Noor is ready to be your skin bestie. 🌿"
- Two CTAs: "💬 Chat with Noor on Telegram" (primary gradient) + "Try Web Demo" (glass secondary)

**Right column:**
- Static chat bubble preview showing a short Noor conversation (3 messages)
- Noor avatar: teal gradient circle with "N"
- Messages in Hinglish: UV/sunscreen advice
- This is a **static** preview (Server Component, no JS) — intentionally different from the full animated version in Section 3. The hero preview is a quick visual hook; Section 3 is the detailed showcase.

### 3. Animated Chat Preview

**Layout:** Centered single chat window on `#F9F2EF` background.

**Header:** "See Sakhiyaan in Action" badge → "Your Sakhiyaan Circle" → subtitle

**Chat window (Client Component):**
- Max-width 680px, white card with 2rem radius
- Chat header: Noor avatar + "Sakhiyaan Circle" + "Noor is online"
- 4 messages that animate in one by one with typing delays:
  1. **Noor:** Morning greeting + humidity-aware skin advice (Hinglish)
  2. **User:** "Thanks! Also my skin is breaking out a lot this week 😩"
  3. **Noor:** Connects breakout to luteal phase + actionable advice (cross-domain knowledge)
  4. **Noor:** Connects to stress + asks about sleep (empathetic, holistic)
- Typing indicator ("● ● ● typing...") between messages
- Animation stops after all messages are shown (no loop)

**Implementation:** Client component with `useEffect` + `setTimeout` chain. Messages stored as an array, revealed one by one with 1.5-2s delays. CSS transitions for fade-in + slide-up on each message.

### 4. Meet the Sakhiyaan

**Layout:** Three cards in a horizontal grid. On mobile, stack vertically.

**Noor card (live):**
- Full opacity, "LIVE" badge (teal bg, white text)
- Teal gradient avatar circle with "N"
- Name: "Noor" | Role: "Skin & Glow Architect"
- Description mentioning Hinglish, hormonal sync, weather awareness
- Two CTAs: "Chat on Telegram" (primary) + "Try Web Demo" (secondary)

**Ruhi card (coming soon):**
- 0.75 opacity, "COMING SOON" badge (muted bg)
- Coral gradient avatar with "R"
- Name: "Ruhi" | Role: "Health & Cycle Synchronizer"
- Description about biological clock, nutrition, sleep, cycle
- "Notify Me →" button (muted style)

**Saahi card (coming soon):**
- Same faded treatment as Ruhi
- Lavender gradient avatar with "S"
- Name: "Saahi" | Role: "Mood & Mindfulness Guide"
- Description about emotional ecosystem, stress patterns, breathing
- "Notify Me →" button

### Email Capture Modal

Triggered by "Notify Me" buttons on the Ruhi and Saahi cards.

- Simple centered modal with backdrop overlay
- Content: "Get notified when [Ruhi/Saahi] launches" headline, email input field, submit button
- On submit: store email (can use a simple API route that writes to DB or a third-party like Resend)
- Success state: "You're on the list! We'll let you know. 💛"
- Uses existing shadcn Dialog component

### Telegram QR Code Modal

Triggered by "Chat with Noor on Telegram" CTA buttons on desktop. On mobile, the CTA links directly to the Telegram deep link.

- Desktop detection: check `window.innerWidth >= 1024` or use user-agent heuristic
- Modal content: "Scan to chat with Noor on Telegram" headline, QR code image (generated from `NEXT_PUBLIC_TELEGRAM_BOT_URL`), fallback "Or open Telegram →" text link below
- QR code: generate at runtime using `qrcode.react` library (lightweight, ~5KB gzipped) from `NEXT_PUBLIC_TELEGRAM_BOT_URL`
- Uses existing shadcn Dialog component
- On mobile: bypasses modal entirely, opens Telegram deep link directly

### 5. Interconnected Care

**Layout:** Two-column grid (diagram left, copy right). On mobile, stacks.

**Left — Orbital diagram:**
- Center circle: coral gradient, "Digital Sanctuary" text
- 5 domain pills orbiting **equally spaced** around the center:
  - 🩸 Period Cycle (coral)
  - 🧴 Skin (teal)
  - 🧠 Mood (lavender)
  - 🍎 Nutrition (gold)
  - ⚡ Energy (coral)
- Dashed circle connecting them (subtle, `#E0BFBD` at 50% opacity)
- Implementation: CSS positioning with `transform: rotate()` + `translate()` for equal spacing at 72° intervals

**Right — Copy:**
- "Interconnected Care" badge
- "The Gap Between Experts" headline
- Two paragraphs: specialists work in isolation → Sakhiyaan connects cortisol → breakout → period
- 3 proof points with icon circles: cross-disciplinary AI, evidence-based insights, "real friends do the research"

### 6. Social Proof

**Layout:** Centered section on cream background.

**Header:** "Trusted by Women Across India" + subtitle

**3 testimonial cards** in horizontal grid:
- Each card: quote text → avatar circle with initial → name, age → city
- Testimonials highlight: cycle-skin connection, Hinglish naturalness, connecting dots
- Placeholder testimonials for now (can be replaced with real ones later)

### 7. Final CTA

**Layout:** Centered text on gradient background (cream transition).

- Headline: "Ready to enter your sanctuary?"
- Subtext: "Noor is waiting to get to know you. Start a conversation — it only takes a message. 💬"
- Same dual CTAs as hero: Telegram primary + Web Demo secondary
- Slightly larger button sizing than hero for emphasis

### 8. Footer

**Layout:** Single row, dark brown background (`#2D1810`).

- Left: "Sakhiyaan" wordmark + "Your Digital Sanctuary" tagline
- Center: Privacy Policy | Terms of Service | Support links
- Right: © 2026 Sakhiyaan
- Mobile: stacks vertically, centered

---

## Responsive Behavior

| Breakpoint | Behavior |
|-----------|----------|
| Desktop (≥1024px) | Two-column layouts, full nav |
| Tablet (768-1023px) | Two-column with tighter gaps, full nav |
| Mobile (<768px) | Single column, hamburger nav, stacked cards, chat window full-width |

---

## Animations

| Element | Animation | Trigger |
|---------|-----------|---------|
| Chat messages (Section 3) | Fade-in + slide-up, 1.5-2s delays | Intersection Observer (when section scrolls into view) |
| Orbital pills (Section 5) | Subtle floating/pulse | CSS keyframes, always running |
| CTA buttons | Scale + shadow on hover | CSS :hover |
| Section entries | Subtle fade-up on scroll | Intersection Observer with threshold |

---

## External Links

| CTA | Destination |
|-----|-------------|
| "Chat with Noor on Telegram" | Mobile: direct link to `https://t.me/Ruhi_Sahki_Bot`. Desktop: opens QR code modal. |
| "Try Web Demo" | `/chat` route (existing web chat) |
| "Notify Me" (Ruhi/Saahi) | Opens email capture modal — collects email for waitlist |
| Footer links | `/privacy`, `/terms`, `/support` — simple placeholder pages with minimal content for now |

---

## File Structure

```
src/app/(marketing)/
  page.tsx                    # Landing page (Server Component)
  layout.tsx                  # Marketing layout (no sidebar/chat UI)

src/components/landing/
  hero.tsx                    # Hero section
  chat-preview.tsx            # Animated chat preview (Client Component)
  companions.tsx              # Meet the Sakhiyaan cards
  interconnected-care.tsx     # Orbital diagram + copy
  social-proof.tsx            # Testimonials
  final-cta.tsx               # Bottom CTA
  nav.tsx                     # Landing page navigation
  footer.tsx                  # Footer
  notify-modal.tsx            # Email capture modal for Ruhi/Saahi waitlist (Client Component)
  telegram-qr-modal.tsx       # QR code modal for Telegram on desktop (Client Component)
```

Uses a `(marketing)` route group to give the landing page its own layout separate from the `(chat)` and `(auth)` groups.

---

## Testing

- Visual: verify all sections render correctly at desktop, tablet, mobile
- Animation: verify chat messages animate in sequence, orbit diagram renders with equal spacing
- Links: verify Telegram deep link opens correctly, Web Demo routes to `/chat`
- Performance: target Lighthouse 95+ (mostly static content, one client component)
- Accessibility: proper heading hierarchy, alt text on images, keyboard-navigable CTAs
