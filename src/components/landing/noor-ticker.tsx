// src/components/landing/noor-ticker.tsx
"use client";

import { useEffect, useState } from "react";

const LINES: { name: string; color: string; text: string }[] = [
  { name: "Noor", color: "#006A65", text: "knows why you break out before your period" },
  { name: "Ruhi", color: "#AE2F34", text: "knows your energy dips aren't laziness — it's your luteal phase" },
  { name: "Saahi", color: "#655975", text: "knows that 3am anxiety is your cortisol talking" },
  { name: "Noor", color: "#006A65", text: "knows which moisturizer works in Mumbai humidity" },
  { name: "Ruhi", color: "#AE2F34", text: "knows why your cravings spike the week before your period" },
  { name: "Saahi", color: "#655975", text: "knows when you need a breathing exercise, not another to-do list" },
  { name: "Noor", color: "#006A65", text: "knows when your skin needs rest, not products" },
  { name: "Ruhi", color: "#AE2F34", text: "knows how your cycle affects your sleep, workouts, and appetite" },
  { name: "Saahi", color: "#655975", text: "knows the difference between a bad day and a pattern" },
  { name: "Noor", color: "#006A65", text: "knows the connection between your stress and your breakouts" },
  { name: "Ruhi", color: "#AE2F34", text: "knows which foods help with period cramps — and which make them worse" },
  { name: "Saahi", color: "#655975", text: "knows that journaling for 2 minutes can change your whole day" },
];

export function NoorTicker() {
  const [index, setIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsVisible(false);
      setTimeout(() => {
        setIndex((prev) => (prev + 1) % LINES.length);
        setIsVisible(true);
      }, 400);
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className="overflow-hidden py-4"
      style={{ backgroundColor: "#F9F2EF" }}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-center gap-3 px-6">
        {/* Pulsing dot */}
        <span
          className="inline-block h-2 w-2 flex-shrink-0 rounded-full"
          style={{
            backgroundColor: LINES[index].color,
            animation: "typingDot 1.5s ease-in-out infinite",
            transition: "background-color 0.4s ease",
          }}
        />

        {/* Text */}
        <p
          className="text-center text-sm font-medium transition-all duration-400"
          style={{
            opacity: isVisible ? 1 : 0,
            transform: isVisible ? "translateY(0)" : "translateY(6px)",
          }}
        >
          <span style={{ color: LINES[index].color, fontWeight: 700 }}>{LINES[index].name}</span>
          <span style={{ color: "#2D1810" }}> {LINES[index].text}</span>
        </p>
      </div>
    </div>
  );
}
