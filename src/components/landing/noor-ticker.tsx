// src/components/landing/noor-ticker.tsx
"use client";

import { useEffect, useState } from "react";

const LINES = [
  "Noor knows why you break out before your period",
  "Noor knows which moisturizer works in Mumbai humidity",
  "Noor knows when your skin needs rest, not products",
  "Noor knows how your cortisol affects your glow",
  "Noor knows why your skin feels different every week",
  "Noor knows the connection between your sleep and your breakouts",
  "Noor knows which ingredients to avoid during your luteal phase",
  "Noor knows when stress is showing up on your face",
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
    }, 3500);

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
            backgroundColor: "#006A65",
            animation: "typingDot 1.5s ease-in-out infinite",
          }}
        />

        {/* Text */}
        <p
          className="text-center text-sm font-medium transition-all duration-400"
          style={{
            color: "#2D1810",
            opacity: isVisible ? 1 : 0,
            transform: isVisible ? "translateY(0)" : "translateY(6px)",
          }}
        >
          {LINES[index]}
        </p>
      </div>
    </div>
  );
}
