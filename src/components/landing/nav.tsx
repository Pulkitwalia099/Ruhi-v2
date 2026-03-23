// src/components/landing/nav.tsx
"use client";

import { TelegramCtaButton } from "./cta-button";

export function LandingNav() {
  return (
    <nav className="sticky top-0 z-50 backdrop-blur-md" style={{ backgroundColor: "rgba(255,248,245,0.85)" }}>
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <a
          href="#"
          className="font-[var(--font-heading)] text-2xl font-bold"
          style={{
            background: "linear-gradient(135deg, #AE2F34, #D4636A)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            letterSpacing: "-0.02em",
            filter: "drop-shadow(0 1px 3px rgba(174,47,52,0.25))",
          }}
        >
          Sakhiyaan
        </a>

        <div className="hidden items-center gap-8 md:flex">
          <a href="#companions" className="text-sm font-medium" style={{ color: "#584140" }}>
            Meet Noor
          </a>
          <a href="#interconnected" className="text-sm font-medium" style={{ color: "#584140" }}>
            About
          </a>
          <TelegramCtaButton variant="primary" />
        </div>

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
