// src/components/landing/hero.tsx
"use client";

import { TelegramCtaButton } from "./cta-button";

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
            <TelegramCtaButton variant="primary" size="large" />
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
