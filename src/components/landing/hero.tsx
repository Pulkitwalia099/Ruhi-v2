// src/components/landing/hero.tsx
"use client";

import { TelegramCtaButton } from "./cta-button";
import { ChatPreview } from "./chat-preview";

export function Hero() {
  return (
    <section className="px-6 pb-20 pt-12">
      <div className="mx-auto grid max-w-6xl items-start gap-12 lg:grid-cols-2 lg:gap-16">
        {/* Left — Copy */}
        <div className="pt-8">
          <span
            className="shine-badge mb-6 inline-block overflow-hidden rounded-full px-4 py-1.5 text-xs font-medium"
            style={{
              backgroundColor: "rgba(0,106,101,0.08)",
              color: "#006A65",
              position: "relative",
            }}
          >
            Introducing Sakhiyaan
            <span
              aria-hidden="true"
              style={{
                position: "absolute",
                inset: 0,
                background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.6) 50%, transparent 100%)",
                backgroundSize: "200% 100%",
                animation: "badge-shine 3s ease-in-out infinite",
              }}
            />
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
            <TelegramCtaButton variant="primary" size="large" />
          </div>
        </div>

        {/* Right — Animated chat preview */}
        <ChatPreview />
      </div>
    </section>
  );
}
