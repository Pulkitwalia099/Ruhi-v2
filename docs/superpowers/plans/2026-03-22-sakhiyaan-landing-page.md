# Sakhiyaan Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a public marketing landing page for Sakhiyaan that drives users to chat with Noor on Telegram, with an animated chat preview showcasing her personality.

**Architecture:** Next.js App Router with a `(marketing)` route group for the landing page, separate from existing `(chat)` and `(auth)` groups. Server Components for all static sections, Client Components only for the animated chat preview, email capture modal, and Telegram QR modal. Tailwind CSS with custom Sakhiyaan design tokens.

**Tech Stack:** Next.js 15, Tailwind CSS 4, shadcn/ui (Dialog), Plus Jakarta Sans + Be Vietnam Pro fonts, qrcode.react, Intersection Observer API

**Spec:** `docs/superpowers/specs/2026-03-22-sakhiyaan-landing-page-design.md`

---

## File Structure

```
src/app/(marketing)/
  page.tsx                    # Landing page — composes all sections (Server Component)
  layout.tsx                  # Marketing layout — fonts, no sidebar/chat chrome

src/components/landing/
  nav.tsx                     # Sticky nav with wordmark + anchor links + CTA
  hero.tsx                    # Hero section — headline, CTAs, static chat preview
  chat-preview.tsx            # Animated chat preview (Client Component)
  companions.tsx              # Meet the Sakhiyaan — 3 cards
  interconnected-care.tsx     # Orbital diagram + "Gap Between Experts" copy
  social-proof.tsx            # Testimonial cards
  final-cta.tsx               # Bottom CTA section
  footer.tsx                  # Dark footer
  notify-modal.tsx            # Email capture modal (Client Component)
  telegram-qr-modal.tsx       # QR code modal for desktop (Client Component)
  cta-button.tsx              # Shared CTA button — handles desktop QR vs mobile direct link (Client Component)

src/app/api/waitlist/route.ts # API route to store waitlist emails
```

---

## Task 1: Install dependencies and add fonts

**Files:**
- Modify: `package.json` (add qrcode.react)
- Modify: `src/app/(marketing)/layout.tsx` (create, with fonts)

- [ ] **Step 1: Install qrcode.react**

```bash
pnpm add qrcode.react
```

- [ ] **Step 2: Add env var**

Add to `.env.local`:
```
NEXT_PUBLIC_TELEGRAM_BOT_URL=https://t.me/Ruhi_Sahki_Bot
```

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml .env.local
git commit -m "chore: add qrcode.react and telegram bot URL env var"
```

---

## Task 2: Create marketing layout with Sakhiyaan fonts

**Files:**
- Create: `src/app/(marketing)/layout.tsx`

The marketing layout loads Plus Jakarta Sans and Be Vietnam Pro (the Sakhiyaan design system fonts) and provides a clean wrapper with no chat sidebar or auth chrome.

- [ ] **Step 1: Create the marketing layout**

```tsx
// src/app/(marketing)/layout.tsx
import { Plus_Jakarta_Sans, Be_Vietnam_Pro } from "next/font/google";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-heading",
  weight: ["500", "600", "700", "800"],
});

const beVietnam = Be_Vietnam_Pro({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-body",
  weight: ["400", "500", "600"],
});

export const metadata = {
  title: "Sakhiyaan — Your Digital Sanctuary",
  description:
    "Meet Noor, your AI skin companion. Guided by science, rooted in empathy, designed for your holistic well-being.",
};

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={`${plusJakarta.variable} ${beVietnam.variable} min-h-screen`}
      style={{ backgroundColor: "#FFF8F5" }}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Verify layout renders**

```bash
pnpm dev
# Visit http://localhost:3000 — should show empty cream page
```

- [ ] **Step 3: Commit**

```bash
git add src/app/\(marketing\)/layout.tsx
git commit -m "feat: add marketing layout with Sakhiyaan fonts"
```

---

## Task 3: Build the navigation bar

**Files:**
- Create: `src/components/landing/nav.tsx`

- [ ] **Step 1: Create nav component**

```tsx
// src/components/landing/nav.tsx
export function LandingNav() {
  return (
    <nav className="sticky top-0 z-50 backdrop-blur-md" style={{ backgroundColor: "rgba(255,248,245,0.85)" }}>
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        {/* Wordmark */}
        <a href="#" className="font-[var(--font-heading)] text-xl font-bold" style={{ color: "#2D1810" }}>
          Sakhiyaan
        </a>

        {/* Desktop links */}
        <div className="hidden items-center gap-8 md:flex">
          <a href="#companions" className="text-sm font-medium" style={{ color: "#584140" }}>
            Meet Noor
          </a>
          <a href="#interconnected" className="text-sm font-medium" style={{ color: "#584140" }}>
            About
          </a>
          <a
            href={process.env.NEXT_PUBLIC_TELEGRAM_BOT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full px-5 py-2.5 text-sm font-semibold text-white"
            style={{ background: "linear-gradient(135deg, #AE2F34, #FF6B6B)" }}
          >
            Chat on Telegram
          </a>
        </div>

        {/* Mobile hamburger — placeholder, enhance later */}
        <button
          className="flex flex-col gap-1.5 md:hidden"
          aria-label="Open menu"
        >
          <span className="block h-0.5 w-6" style={{ backgroundColor: "#2D1810" }} />
          <span className="block h-0.5 w-6" style={{ backgroundColor: "#2D1810" }} />
          <span className="block h-0.5 w-6" style={{ backgroundColor: "#2D1810" }} />
        </button>
      </div>
    </nav>
  );
}
```

Note: The nav CTA link goes directly to Telegram for now. Task 9 will upgrade it to use the QR modal on desktop via the shared `CtaButton` component.

- [ ] **Step 2: Commit**

```bash
git add src/components/landing/nav.tsx
git commit -m "feat: add landing page navigation bar"
```

---

## Task 4: Build the hero section

**Files:**
- Create: `src/components/landing/hero.tsx`

- [ ] **Step 1: Create hero component**

```tsx
// src/components/landing/hero.tsx
export function Hero() {
  return (
    <section className="px-6 pb-20 pt-12">
      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2 lg:gap-16">
        {/* Left — Copy */}
        <div>
          <span
            className="mb-6 inline-block rounded-full px-4 py-1.5 text-xs font-medium"
            style={{ backgroundColor: "rgba(0,106,101,0.08)", color: "#006A65" }}
          >
            Introducing Sakhiyaan
          </span>

          <h1
            className="mb-6 font-[var(--font-heading)] text-4xl font-extrabold leading-tight tracking-tight lg:text-5xl"
            style={{ color: "#2D1810", letterSpacing: "-0.03em" }}
          >
            Meet the{" "}
            <span style={{ color: "#AE2F34" }}>truly yours</span>
            <br />
            for your Skin, Health,
            <br />
            and Mood.
          </h1>

          <p
            className="mb-8 max-w-lg text-lg leading-relaxed"
            style={{ color: "#584140" }}
          >
            Your circle of companions — guided by science, rooted in empathy.
            Noor is ready to be your skin bestie. 🌿
          </p>

          <div className="flex flex-wrap gap-3">
            <a
              href={process.env.NEXT_PUBLIC_TELEGRAM_BOT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full px-7 py-3.5 text-base font-semibold text-white"
              style={{
                background: "linear-gradient(135deg, #AE2F34, #FF6B6B)",
                boxShadow: "0 8px 24px rgba(174,47,52,0.25)",
              }}
            >
              💬 Chat with Noor on Telegram
            </a>
            <a
              href="/chat"
              className="rounded-full px-7 py-3.5 text-base font-medium"
              style={{
                backgroundColor: "rgba(232,225,222,0.6)",
                backdropFilter: "blur(10px)",
                color: "#2D1810",
              }}
            >
              Try Web Demo
            </a>
          </div>
        </div>

        {/* Right — Static chat preview */}
        <div
          className="rounded-3xl p-6"
          style={{
            backgroundColor: "#FFFFFF",
            boxShadow: "0 24px 48px rgba(29,27,26,0.06)",
          }}
        >
          {/* Chat header */}
          <div className="mb-4 flex items-center gap-3 border-b pb-3" style={{ borderColor: "#F9F2EF" }}>
            <div
              className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white"
              style={{ background: "linear-gradient(135deg, #006A65, #4ECDC4)" }}
            >
              N
            </div>
            <div>
              <div className="text-sm font-semibold" style={{ color: "#2D1810" }}>Noor</div>
              <div className="text-xs" style={{ color: "#8c706f" }}>Skin Architect · Online</div>
            </div>
          </div>

          {/* Static messages */}
          <div className="flex flex-col gap-3">
            <div className="max-w-[85%] rounded-2xl rounded-bl-sm px-4 py-3 text-sm leading-relaxed" style={{ backgroundColor: "#F9F2EF", color: "#2D1810" }}>
              Hey! UV index aaj high hai ☀️ Sunscreen lagayi kya?
            </div>
            <div
              className="max-w-[75%] self-end rounded-2xl rounded-br-sm px-4 py-3 text-sm leading-relaxed text-white"
              style={{ background: "linear-gradient(135deg, #AE2F34, #FF6B6B)" }}
            >
              Not yet! Which one should I use?
            </div>
            <div className="max-w-[85%] rounded-2xl rounded-bl-sm px-4 py-3 text-sm leading-relaxed" style={{ backgroundColor: "#F9F2EF", color: "#2D1810" }}>
              SPF 50+ broad spectrum — gel-based since humidity bhi high hai. Aapki skin will thank you! 🧴✨
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
```

Note: Hero CTAs are static `<a>` tags for now. Task 9 upgrades them to the shared `CtaButton` with QR modal support.

- [ ] **Step 2: Commit**

```bash
git add src/components/landing/hero.tsx
git commit -m "feat: add hero section with static chat preview"
```

---

## Task 5: Build the animated chat preview (Client Component)

**Files:**
- Create: `src/components/landing/chat-preview.tsx`

- [ ] **Step 1: Create animated chat preview**

```tsx
// src/components/landing/chat-preview.tsx
"use client";

import { useEffect, useRef, useState } from "react";

const MESSAGES = [
  {
    sender: "noor",
    label: "NOOR · SKIN ARCHITECT",
    text: "Good morning! ☀️ Aaj humidity 78% hai — your skin might feel chipchipa. A light gel moisturizer would work best today.",
  },
  {
    sender: "user",
    text: "Thanks Noor! Also my skin is breaking out a lot this week 😩",
  },
  {
    sender: "noor",
    label: "NOOR · SKIN ARCHITECT",
    text: "That makes sense — you're in your luteal phase right now. Progesterone increases sebum production. 🧬 Try a salicylic acid cleanser at night and keep your routine simple. No new products this week!",
  },
  {
    sender: "noor",
    label: "NOOR · SKIN ARCHITECT",
    text: "Also — stress bhi breakouts ka reason ho sakta hai. Kal raat neend kaisi thi? 💛 Sometimes the skin is just telling you to slow down.",
  },
] as const;

export function ChatPreview() {
  const [visibleCount, setVisibleCount] = useState(0);
  const [showTyping, setShowTyping] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true;
          animateMessages();
        }
      },
      { threshold: 0.3 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  function animateMessages() {
    let i = 0;
    function showNext() {
      if (i >= MESSAGES.length) {
        setShowTyping(false);
        return;
      }
      setShowTyping(true);
      setTimeout(() => {
        setShowTyping(false);
        setVisibleCount(i + 1);
        i++;
        if (i < MESSAGES.length) {
          setTimeout(showNext, 800);
        }
      }, 1500);
    }
    setTimeout(showNext, 500);
  }

  return (
    <section ref={sectionRef} className="px-6 py-20" style={{ backgroundColor: "#F9F2EF" }}>
      {/* Header */}
      <div className="mb-10 text-center">
        <span
          className="mb-4 inline-block rounded-full px-4 py-1.5 text-xs font-medium"
          style={{ backgroundColor: "rgba(174,47,52,0.08)", color: "#AE2F34" }}
        >
          See Sakhiyaan in Action
        </span>
        <h2
          className="mb-2 font-[var(--font-heading)] text-3xl font-bold"
          style={{ color: "#2D1810" }}
        >
          Your Sakhiyaan Circle
        </h2>
        <p style={{ color: "#584140" }}>
          A real conversation — watch how Noor connects skin, health, and mood.
        </p>
      </div>

      {/* Chat window */}
      <div
        className="mx-auto max-w-[680px] rounded-3xl p-6"
        style={{ backgroundColor: "#FFFFFF", boxShadow: "0 24px 48px rgba(29,27,26,0.06)" }}
      >
        {/* Chat header */}
        <div className="mb-4 flex items-center gap-3 border-b pb-3" style={{ borderColor: "#F9F2EF" }}>
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white"
            style={{ background: "linear-gradient(135deg, #006A65, #4ECDC4)" }}
          >
            N
          </div>
          <div>
            <div className="text-sm font-semibold" style={{ color: "#2D1810" }}>Sakhiyaan Circle</div>
            <div className="text-xs" style={{ color: "#006A65" }}>Noor is online</div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex flex-col gap-3">
          {MESSAGES.slice(0, visibleCount).map((msg, i) => (
            <div
              key={i}
              className="transition-all duration-500"
              style={{
                opacity: 1,
                transform: "translateY(0)",
                animation: "fadeSlideUp 0.5s ease-out",
              }}
            >
              {msg.sender === "noor" ? (
                <div className="flex gap-2">
                  <div
                    className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[0.6rem] font-bold text-white"
                    style={{ background: "linear-gradient(135deg, #006A65, #4ECDC4)" }}
                  >
                    N
                  </div>
                  <div>
                    <div className="mb-1 text-[0.7rem] font-semibold" style={{ color: "#006A65" }}>
                      {msg.label}
                    </div>
                    <div
                      className="rounded-2xl rounded-bl-sm px-4 py-3 text-sm leading-relaxed"
                      style={{ backgroundColor: "#F9F2EF", color: "#2D1810" }}
                    >
                      {msg.text}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="max-w-[75%] self-end">
                  <div
                    className="rounded-2xl rounded-br-sm px-4 py-3 text-sm leading-relaxed text-white"
                    style={{ background: "linear-gradient(135deg, #AE2F34, #FF6B6B)" }}
                  >
                    {msg.text}
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Typing indicator */}
          {showTyping && (
            <div className="flex items-center gap-2">
              <div
                className="flex h-7 w-7 items-center justify-center rounded-full text-[0.6rem] font-bold text-white"
                style={{ background: "linear-gradient(135deg, #006A65, #4ECDC4)" }}
              >
                N
              </div>
              <div className="rounded-full px-4 py-2 text-xs" style={{ backgroundColor: "#F9F2EF", color: "#8c706f" }}>
                ● ● ● typing...
              </div>
            </div>
          )}
        </div>
      </div>

      <p className="mt-4 text-center text-xs" style={{ color: "#8c706f" }}>
        ✨ Noor connects skin science with your daily life
      </p>
    </section>
  );
}
```

- [ ] **Step 2: Add the fadeSlideUp keyframe to globals.css**

Add at the end of `src/app/globals.css`:

```css
@keyframes fadeSlideUp {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/landing/chat-preview.tsx src/app/globals.css
git commit -m "feat: add animated chat preview with intersection observer"
```

---

## Task 6: Build the companions section

**Files:**
- Create: `src/components/landing/companions.tsx`

- [ ] **Step 1: Create companions component**

```tsx
// src/components/landing/companions.tsx
const COMPANIONS = [
  {
    name: "Noor",
    role: "Skin & Glow Architect",
    description:
      "Your personalized skin bestie. Syncs your routine with hormonal cycles, weather, and lifestyle — in Hinglish, with love. 🧴",
    gradient: "linear-gradient(135deg, #006A65, #4ECDC4)",
    roleColor: "#006A65",
    initial: "N",
    live: true,
  },
  {
    name: "Ruhi",
    role: "Health & Cycle Synchronizer",
    description:
      "Decodes your biological clock. Understands nutrition, sleep, and activity through the lens of your monthly cycle. 🌙",
    gradient: "linear-gradient(135deg, #AE2F34, #FF6B6B)",
    roleColor: "#AE2F34",
    initial: "R",
    live: false,
  },
  {
    name: "Saahi",
    role: "Mood & Mindfulness Guide",
    description:
      "Your emotional ecosystem expert. Tracks stress patterns and offers breathing exercises when you need them most. 💛",
    gradient: "linear-gradient(135deg, #655975, #A495B4)",
    roleColor: "#655975",
    initial: "S",
    live: false,
  },
] as const;

export function Companions() {
  return (
    <section id="companions" className="px-6 py-20" style={{ backgroundColor: "#FFF8F5" }}>
      <div className="mx-auto max-w-5xl">
        <div className="mb-12 text-center">
          <h2 className="mb-2 font-[var(--font-heading)] text-3xl font-bold" style={{ color: "#2D1810" }}>
            Meet the Sakhiyaan
          </h2>
          <p style={{ color: "#584140" }}>Your specialized companions for every facet of your being.</p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {COMPANIONS.map((c) => (
            <div
              key={c.name}
              className="relative overflow-hidden rounded-3xl p-6"
              style={{
                backgroundColor: "#FFFFFF",
                boxShadow: "0 24px 48px rgba(29,27,26,0.06)",
                opacity: c.live ? 1 : 0.75,
              }}
            >
              {/* Badge */}
              <span
                className="absolute right-4 top-4 rounded-full px-3 py-1 text-[0.7rem] font-semibold"
                style={
                  c.live
                    ? { backgroundColor: "#006A65", color: "#FFFFFF" }
                    : { backgroundColor: "#E8E1DE", color: "#584140" }
                }
              >
                {c.live ? "LIVE" : "COMING SOON"}
              </span>

              {/* Avatar */}
              <div
                className="mb-4 flex h-14 w-14 items-center justify-center rounded-full text-xl font-bold text-white"
                style={{ background: c.gradient }}
              >
                {c.initial}
              </div>

              <h3 className="mb-1 font-[var(--font-heading)] text-xl font-bold" style={{ color: "#2D1810" }}>
                {c.name}
              </h3>
              <div className="mb-3 text-xs font-medium" style={{ color: c.roleColor }}>
                {c.role}
              </div>
              <p className="mb-5 text-sm leading-relaxed" style={{ color: "#584140" }}>
                {c.description}
              </p>

              {/* CTAs */}
              {c.live ? (
                <div className="flex flex-wrap gap-2">
                  <a
                    href={process.env.NEXT_PUBLIC_TELEGRAM_BOT_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-full px-4 py-2 text-sm font-semibold text-white"
                    style={{ background: "linear-gradient(135deg, #AE2F34, #FF6B6B)" }}
                  >
                    Chat on Telegram
                  </a>
                  <a
                    href="/chat"
                    className="rounded-full px-4 py-2 text-sm font-medium"
                    style={{ backgroundColor: "#F9F2EF", color: "#2D1810" }}
                  >
                    Try Web Demo
                  </a>
                </div>
              ) : (
                <button
                  className="rounded-full px-4 py-2 text-sm font-medium"
                  style={{ backgroundColor: "#F9F2EF", color: "#8c706f" }}
                >
                  Notify Me →
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

Note: "Notify Me" button is a plain `<button>` for now. Task 8 will connect it to the email capture modal.

- [ ] **Step 2: Commit**

```bash
git add src/components/landing/companions.tsx
git commit -m "feat: add companions section with Noor, Ruhi, Saahi cards"
```

---

## Task 7: Build interconnected care, social proof, final CTA, and footer

**Files:**
- Create: `src/components/landing/interconnected-care.tsx`
- Create: `src/components/landing/social-proof.tsx`
- Create: `src/components/landing/final-cta.tsx`
- Create: `src/components/landing/footer.tsx`

- [ ] **Step 1: Create interconnected care with orbital diagram**

```tsx
// src/components/landing/interconnected-care.tsx
const DOMAINS = [
  { emoji: "🩸", label: "Period Cycle", color: "#AE2F34" },
  { emoji: "🧴", label: "Skin", color: "#006A65" },
  { emoji: "🧠", label: "Mood", color: "#655975" },
  { emoji: "🍎", label: "Nutrition", color: "#D4A574" },
  { emoji: "⚡", label: "Energy", color: "#AE2F34" },
];

const PROOF_POINTS = [
  { icon: "🔗", text: "Cross-disciplinary AI that sees the full picture" },
  { icon: "📋", text: "Evidence-based insights from clinical research" },
  { icon: "💛", text: "Real friends do the research for you" },
];

export function InterconnectedCare() {
  return (
    <section id="interconnected" className="px-6 py-20" style={{ backgroundColor: "#F9F2EF" }}>
      <div className="mx-auto grid max-w-5xl items-center gap-16 lg:grid-cols-2">
        {/* Left — Orbital diagram */}
        <div className="relative mx-auto flex h-[380px] w-[380px] items-center justify-center">
          {/* Dashed orbit */}
          <div
            className="absolute rounded-full"
            style={{
              inset: "40px",
              border: "2px dashed #E0BFBD",
              opacity: 0.5,
            }}
          />

          {/* Center */}
          <div
            className="z-10 flex h-28 w-28 items-center justify-center rounded-full text-center text-sm font-bold leading-tight text-white"
            style={{
              background: "linear-gradient(135deg, #AE2F34, #FF6B6B)",
              boxShadow: "0 12px 32px rgba(174,47,52,0.3)",
            }}
          >
            Digital
            <br />
            Sanctuary
          </div>

          {/* Orbiting pills — equally spaced at 72° intervals */}
          {DOMAINS.map((d, i) => {
            const angle = (i * 72 - 90) * (Math.PI / 180); // start from top
            const radius = 150;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            return (
              <div
                key={d.label}
                className="absolute rounded-full px-3 py-2 text-xs font-medium"
                style={{
                  left: `calc(50% + ${x}px - 52px)`,
                  top: `calc(50% + ${y}px - 16px)`,
                  backgroundColor: "#FFFFFF",
                  color: d.color,
                  boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
                  whiteSpace: "nowrap",
                }}
              >
                {d.emoji} {d.label}
              </div>
            );
          })}
        </div>

        {/* Right — Copy */}
        <div>
          <span
            className="mb-4 inline-block rounded-full px-4 py-1.5 text-xs font-medium"
            style={{ backgroundColor: "rgba(174,47,52,0.08)", color: "#AE2F34" }}
          >
            Interconnected Care
          </span>

          <h2 className="mb-4 font-[var(--font-heading)] text-3xl font-bold" style={{ color: "#2D1810" }}>
            The Gap Between Experts
          </h2>

          <p className="mb-4 leading-relaxed" style={{ color: "#584140" }}>
            Your gynecologist looks at your cycle. Your dermatologist looks at your acne.
            Your therapist looks at your stress.{" "}
            <strong>But they rarely look at each other.</strong>
          </p>

          <p className="mb-6 leading-relaxed" style={{ color: "#584140" }}>
            Sakhiyaan connects the dots — because your cortisol spike on Wednesday is causing
            that breakout on Friday, right before your period. We're the only ones who truly
            know you, every single day.
          </p>

          <div className="flex flex-col gap-3">
            {PROOF_POINTS.map((p) => (
              <div key={p.text} className="flex items-center gap-3">
                <div
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm"
                  style={{ backgroundColor: "rgba(0,106,101,0.1)" }}
                >
                  {p.icon}
                </div>
                <span className="text-sm" style={{ color: "#2D1810" }}>{p.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 1b: Add orbital pulse animation to globals.css**

Add after the `fadeSlideUp` keyframe in `src/app/globals.css`:

```css
@keyframes orbitalFloat {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}
```

Then add `animation: "orbitalFloat 3s ease-in-out infinite"` with staggered delays to each orbital pill in `interconnected-care.tsx`. Add to the pill's style:
```tsx
animationDelay: `${i * 0.4}s`,
animation: "orbitalFloat 3s ease-in-out infinite",
```

- [ ] **Step 2: Create social proof**

```tsx
// src/components/landing/social-proof.tsx
const TESTIMONIALS = [
  {
    quote: "Noor told me my breakouts were linked to my cycle phase. My dermatologist never mentioned that!",
    name: "Priya, 24",
    city: "Mumbai",
    initial: "P",
  },
  {
    quote: "It's like having a bestie who actually studied dermatology. Hinglish mein baat karna makes it feel so natural 💛",
    name: "Ananya, 28",
    city: "Delhi",
    initial: "A",
  },
  {
    quote: "Finally someone who connects the dots. Noor saw that my stress was causing my skin issues before I did.",
    name: "Meera, 22",
    city: "Bangalore",
    initial: "M",
  },
];

export function SocialProof() {
  return (
    <section className="px-6 py-20" style={{ backgroundColor: "#FFF8F5" }}>
      <div className="mx-auto max-w-4xl text-center">
        <h2 className="mb-2 font-[var(--font-heading)] text-3xl font-bold" style={{ color: "#2D1810" }}>
          Trusted by Women Across India
        </h2>
        <p className="mb-10" style={{ color: "#584140" }}>
          Real stories from women who chat with Noor every day.
        </p>

        <div className="grid gap-5 md:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <div
              key={t.name}
              className="rounded-3xl p-6 text-left"
              style={{ backgroundColor: "#FFFFFF", boxShadow: "0 12px 32px rgba(29,27,26,0.04)" }}
            >
              <p className="mb-4 text-sm leading-relaxed" style={{ color: "#584140" }}>
                "{t.quote}"
              </p>
              <div className="flex items-center gap-2">
                <div
                  className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold"
                  style={{ backgroundColor: "#F9F2EF", color: "#584140" }}
                >
                  {t.initial}
                </div>
                <div>
                  <div className="text-xs font-semibold" style={{ color: "#2D1810" }}>{t.name}</div>
                  <div className="text-[0.7rem]" style={{ color: "#8c706f" }}>{t.city}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Create final CTA**

```tsx
// src/components/landing/final-cta.tsx
export function FinalCta() {
  return (
    <section className="px-6 py-20" style={{ background: "linear-gradient(180deg, #F9F2EF, #FFF8F5)" }}>
      <div className="mx-auto max-w-xl text-center">
        <h2
          className="mb-3 font-[var(--font-heading)] text-4xl font-bold leading-tight"
          style={{ color: "#2D1810" }}
        >
          Ready to enter your sanctuary?
        </h2>
        <p className="mb-8 text-lg leading-relaxed" style={{ color: "#584140" }}>
          Noor is waiting to get to know you. Start a conversation — it only takes a message. 💬
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <a
            href={process.env.NEXT_PUBLIC_TELEGRAM_BOT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full px-8 py-4 text-lg font-semibold text-white"
            style={{
              background: "linear-gradient(135deg, #AE2F34, #FF6B6B)",
              boxShadow: "0 8px 24px rgba(174,47,52,0.25)",
            }}
          >
            💬 Chat with Noor on Telegram
          </a>
          <a
            href="/chat"
            className="rounded-full px-8 py-4 text-lg font-medium"
            style={{
              backgroundColor: "rgba(232,225,222,0.6)",
              backdropFilter: "blur(10px)",
              color: "#2D1810",
            }}
          >
            Try Web Demo
          </a>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Create footer**

```tsx
// src/components/landing/footer.tsx
export function Footer() {
  return (
    <footer className="px-6 py-6" style={{ backgroundColor: "#2D1810" }}>
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 md:flex-row md:justify-between">
        <div>
          <div className="text-lg font-bold" style={{ color: "#FFF8F5" }}>Sakhiyaan</div>
          <div className="text-xs" style={{ color: "#8c706f" }}>Your Digital Sanctuary</div>
        </div>
        <div className="flex gap-6">
          <a href="/privacy" className="text-sm" style={{ color: "#E0BFBD" }}>Privacy Policy</a>
          <a href="/terms" className="text-sm" style={{ color: "#E0BFBD" }}>Terms of Service</a>
          <a href="/support" className="text-sm" style={{ color: "#E0BFBD" }}>Support</a>
        </div>
        <div className="text-xs" style={{ color: "#8c706f" }}>© 2026 Sakhiyaan</div>
      </div>
    </footer>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/landing/interconnected-care.tsx src/components/landing/social-proof.tsx src/components/landing/final-cta.tsx src/components/landing/footer.tsx
git commit -m "feat: add interconnected care, social proof, final CTA, and footer"
```

---

## Task 8: Build email capture modal and waitlist API

**Files:**
- Create: `src/components/landing/notify-modal.tsx`
- Create: `src/app/api/waitlist/route.ts`
- Modify: `src/components/landing/companions.tsx` (connect modal)

- [ ] **Step 1: Create the notify modal (Client Component)**

```tsx
// src/components/landing/notify-modal.tsx
"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface NotifyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companionName: string;
}

export function NotifyModal({ open, onOpenChange, companionName }: NotifyModalProps) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, companion: companionName }),
      });
      if (!res.ok) throw new Error();
      setStatus("success");
    } catch {
      setStatus("error");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl border-0 sm:max-w-md" style={{ backgroundColor: "#FFF8F5" }}>
        <DialogHeader>
          <DialogTitle
            className="font-[var(--font-heading)] text-xl font-bold"
            style={{ color: "#2D1810" }}
          >
            Get notified when {companionName} launches
          </DialogTitle>
          <DialogDescription style={{ color: "#584140" }}>
            We'll send you one email. No spam, promise.
          </DialogDescription>
        </DialogHeader>

        {status === "success" ? (
          <div className="py-6 text-center">
            <p className="text-lg font-medium" style={{ color: "#2D1810" }}>
              You're on the list! We'll let you know. 💛
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-2">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="rounded-full px-5 py-3 text-sm outline-none"
              style={{ backgroundColor: "#F9F2EF", color: "#2D1810" }}
            />
            <button
              type="submit"
              disabled={status === "loading"}
              className="rounded-full px-6 py-3 text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, #AE2F34, #FF6B6B)" }}
            >
              {status === "loading" ? "Saving..." : "Notify Me"}
            </button>
            {status === "error" && (
              <p className="text-center text-sm" style={{ color: "#BA1A1A" }}>
                Something went wrong. Try again?
              </p>
            )}
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Create waitlist API route**

```tsx
// src/app/api/waitlist/route.ts
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { email, companion } = await request.json();

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  // TODO: Store in database. For now, log to console.
  console.log(`[waitlist] ${email} wants to know when ${companion} launches`);

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Update companions.tsx to be a Client Component and use the modal**

Convert companions to a client component wrapper that manages modal state. Replace the `<button>Notify Me</button>` with modal trigger. The companion data stays the same — just add the modal integration:

Replace the `"use client"` and state management at the top, and update the "Notify Me" button `onClick`.

The full updated component wraps the existing markup with:
```tsx
"use client";
import { useState } from "react";
import { NotifyModal } from "./notify-modal";
// ... existing COMPANIONS data ...
export function Companions() {
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [selectedCompanion, setSelectedCompanion] = useState("");
  // ... existing JSX, but update the Notify Me button:
  // onClick={() => { setSelectedCompanion(c.name); setNotifyOpen(true); }}
  // ... add <NotifyModal> at the end
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/landing/notify-modal.tsx src/app/api/waitlist/route.ts src/components/landing/companions.tsx
git commit -m "feat: add email capture modal and waitlist API for Ruhi/Saahi"
```

---

## Task 9: Build Telegram QR modal and shared CTA button

**Files:**
- Create: `src/components/landing/telegram-qr-modal.tsx`
- Create: `src/components/landing/cta-button.tsx`
- Modify: `src/components/landing/hero.tsx` (use CTA button)
- Modify: `src/components/landing/nav.tsx` (use CTA button)
- Modify: `src/components/landing/final-cta.tsx` (use CTA button)
- Modify: `src/components/landing/companions.tsx` (use CTA button for Noor)

- [ ] **Step 1: Create Telegram QR modal**

```tsx
// src/components/landing/telegram-qr-modal.tsx
"use client";

import { QRCodeSVG } from "qrcode.react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const TELEGRAM_URL = process.env.NEXT_PUBLIC_TELEGRAM_BOT_URL!;

interface TelegramQrModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TelegramQrModal({ open, onOpenChange }: TelegramQrModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl border-0 sm:max-w-sm" style={{ backgroundColor: "#FFF8F5" }}>
        <DialogHeader>
          <DialogTitle
            className="font-[var(--font-heading)] text-xl font-bold"
            style={{ color: "#2D1810" }}
          >
            Scan to chat with Noor
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-4">
          <div className="rounded-2xl bg-white p-4">
            <QRCodeSVG
              value={TELEGRAM_URL}
              size={200}
              fgColor="#2D1810"
              bgColor="#FFFFFF"
            />
          </div>
          <a
            href={TELEGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium underline"
            style={{ color: "#006A65" }}
          >
            Or open Telegram →
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Create shared CTA button**

```tsx
// src/components/landing/cta-button.tsx
"use client";

import { useState } from "react";
import { TelegramQrModal } from "./telegram-qr-modal";

interface CtaButtonProps {
  variant: "primary" | "secondary";
  size?: "default" | "large";
  className?: string;
}

const TELEGRAM_URL = process.env.NEXT_PUBLIC_TELEGRAM_BOT_URL!;

export function TelegramCtaButton({ variant, size = "default", className = "" }: CtaButtonProps) {
  const [qrOpen, setQrOpen] = useState(false);

  const padding = size === "large" ? "px-8 py-4 text-lg" : "px-5 py-2.5 text-sm";

  function handleClick() {
    // On mobile, open Telegram directly
    if (window.innerWidth < 1024) {
      window.open(TELEGRAM_URL, "_blank");
      return;
    }
    // On desktop, show QR modal
    setQrOpen(true);
  }

  return (
    <>
      <button
        onClick={handleClick}
        className={`rounded-full font-semibold ${padding} ${className}`}
        style={
          variant === "primary"
            ? {
                background: "linear-gradient(135deg, #AE2F34, #FF6B6B)",
                color: "#FFFFFF",
                boxShadow: "0 8px 24px rgba(174,47,52,0.25)",
              }
            : undefined
        }
      >
        {size === "large" ? "💬 Chat with Noor on Telegram" : "Chat on Telegram"}
      </button>
      <TelegramQrModal open={qrOpen} onOpenChange={setQrOpen} />
    </>
  );
}
```

- [ ] **Step 3: Update hero, nav, final-cta, and companions to use TelegramCtaButton**

Each of these components needs three changes:
1. Add `"use client";` at the top (if not already present)
2. Add `import { TelegramCtaButton } from "./cta-button";`
3. Replace the Telegram `<a>` tag with `<TelegramCtaButton>`

**hero.tsx** — replace the Telegram `<a>` with:
```tsx
<TelegramCtaButton variant="primary" size="large" />
```

**nav.tsx** — replace the Telegram `<a>` with:
```tsx
<TelegramCtaButton variant="primary" />
```

**final-cta.tsx** — replace the Telegram `<a>` with:
```tsx
<TelegramCtaButton variant="primary" size="large" />
```

**companions.tsx** — in the Noor card's CTA area, replace the Telegram `<a>` with:
```tsx
<TelegramCtaButton variant="primary" />
```

- [ ] **Step 4: Commit**

```bash
git add src/components/landing/telegram-qr-modal.tsx src/components/landing/cta-button.tsx src/components/landing/hero.tsx src/components/landing/nav.tsx src/components/landing/final-cta.tsx src/components/landing/companions.tsx
git commit -m "feat: add Telegram QR modal and shared CTA button with desktop/mobile handling"
```

---

## Task 10: Compose the landing page and wire everything up

**Files:**
- Create: `src/app/(marketing)/page.tsx`

- [ ] **Step 1: Create the landing page**

```tsx
// src/app/(marketing)/page.tsx
import { LandingNav } from "@/components/landing/nav";
import { Hero } from "@/components/landing/hero";
import { ChatPreview } from "@/components/landing/chat-preview";
import { Companions } from "@/components/landing/companions";
import { InterconnectedCare } from "@/components/landing/interconnected-care";
import { SocialProof } from "@/components/landing/social-proof";
import { FinalCta } from "@/components/landing/final-cta";
import { Footer } from "@/components/landing/footer";

export default function LandingPage() {
  return (
    <>
      <LandingNav />
      <main>
        <Hero />
        <ChatPreview />
        <Companions />
        <InterconnectedCare />
        <SocialProof />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}
```

- [ ] **Step 2: Verify the full page renders**

```bash
pnpm dev
# Visit http://localhost:3000
# Verify: all 7 sections visible, fonts correct, animations work, modals open
```

- [ ] **Step 3: Commit**

```bash
git add src/app/\(marketing\)/page.tsx
git commit -m "feat: compose landing page with all sections"
```

---

## Task 11: Route conflict resolution

**Files:**
- Modify: `src/app/(chat)/page.tsx` or routing config

The `(marketing)` and `(chat)` route groups both claim `/`. Next.js will error on this. Resolution: move the existing chat page to `/chat` explicitly.

- [ ] **Step 1: Check current routing**

Verify if `(chat)` has a `page.tsx` at root level that conflicts. The existing `(chat)/page.tsx` returns `null`, so we can safely remove it or redirect it.

- [ ] **Step 2: Remove or redirect the conflicting page**

Since `(chat)/page.tsx` returns `null` and the chat experience lives at `/chat/[id]`, remove the empty page:

```bash
rm src/app/\(chat\)/page.tsx
```

Or if other routes depend on it, convert to a redirect to `/`.

- [ ] **Step 3: Verify no route conflicts**

```bash
pnpm dev
# Visit http://localhost:3000 — should show landing page
# Visit http://localhost:3000/chat — should show chat (via existing chat routes)
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "fix: resolve route conflict between marketing and chat groups"
```

---

## Task 12: Polish and verify

- [ ] **Step 1: Test responsive behavior**

Open dev tools, check at:
- Desktop (1440px): two-column layouts, full nav
- Tablet (768px): tighter gaps
- Mobile (375px): single column, stacked cards

- [ ] **Step 2: Test all interactive elements**

- Click "Chat on Telegram" on desktop → QR modal opens
- Click "Chat on Telegram" on mobile viewport → opens Telegram link
- Click "Try Web Demo" → navigates to `/chat`
- Click "Notify Me" on Ruhi/Saahi → email modal opens
- Submit email → success message
- Scroll to chat preview → messages animate in

- [ ] **Step 3: Check accessibility**

- Heading hierarchy: h1 (hero) → h2 (sections) → h3 (cards)
- All buttons/links keyboard-navigable
- Modals trap focus correctly (shadcn Dialog does this)

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "polish: responsive layout, accessibility, and interaction verification"
```
