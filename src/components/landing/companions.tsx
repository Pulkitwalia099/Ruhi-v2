"use client";

// src/components/landing/companions.tsx
import { useState } from "react";
import { NotifyModal } from "./notify-modal";

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
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [selectedCompanion, setSelectedCompanion] = useState("");

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
                </div>
              ) : (
                <button
                  className="rounded-full px-4 py-2 text-sm font-medium"
                  style={{ backgroundColor: "#F9F2EF", color: "#8c706f" }}
                  onClick={() => { setSelectedCompanion(c.name); setNotifyOpen(true); }}
                >
                  Notify Me →
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
      <NotifyModal open={notifyOpen} onOpenChange={setNotifyOpen} companionName={selectedCompanion} />
    </section>
  );
}
