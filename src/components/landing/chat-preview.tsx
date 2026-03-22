// src/components/landing/chat-preview.tsx
"use client";

import { useEffect, useRef, useState } from "react";

const MESSAGES = [
  {
    sender: "noor",
    label: "NOOR · SKIN ARCHITECT",
    color: "#006A65",
    gradient: "linear-gradient(135deg, #006A65, #4ECDC4)",
    initial: "N",
    text: "Priya, today's UV index is high in your area! ☀️ Yaad se apply your sunscreen before heading out. Aapki skin will thank you later!",
  },
  {
    sender: "ruhi",
    label: "RUHI · CYCLE SYNC",
    color: "#AE2F34",
    gradient: "linear-gradient(135deg, #AE2F34, #FF6B6B)",
    initial: "R",
    text: "Bilkul Noor! And Priya, you're in your Follicular phase now. Energy levels increase ho rahe hain, perfect time for a light workout! 💪",
  },
  {
    sender: "user",
    text: "Thanks Sakhiyaan! I'll put on some SPF 50 right now. Feeling a bit anxious today though.",
  },
  {
    sender: "saahi",
    label: "SAAHI · MINDFULNESS GUIDE",
    color: "#655975",
    gradient: "linear-gradient(135deg, #655975, #A495B4)",
    initial: "S",
    text: "I hear you, Priya. ❤️ Anxiety is just a visitor. Ek choti si breathing exercise karein? Just 2 minutes to center yourself. Shall we?",
  },
] as const;

export function ChatPreview() {
  const [visibleCount, setVisibleCount] = useState(0);
  const [showTyping, setShowTyping] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    const el = containerRef.current;
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
    <div
      ref={containerRef}
      className="rounded-3xl p-5"
      style={{
        backgroundColor: "#FFFFFF",
        boxShadow: "0 24px 48px rgba(29,27,26,0.06)",
      }}
    >
      {/* Chat header */}
      <div className="mb-4 flex items-center gap-3 border-b pb-3" style={{ borderColor: "#F9F2EF" }}>
        <div className="flex -space-x-1.5">
          <div
            className="flex h-7 w-7 items-center justify-center rounded-full text-[0.6rem] font-bold text-white ring-2 ring-white"
            style={{ background: "linear-gradient(135deg, #006A65, #4ECDC4)" }}
          >
            N
          </div>
          <div
            className="flex h-7 w-7 items-center justify-center rounded-full text-[0.6rem] font-bold text-white ring-2 ring-white"
            style={{ background: "linear-gradient(135deg, #AE2F34, #FF6B6B)" }}
          >
            R
          </div>
          <div
            className="flex h-7 w-7 items-center justify-center rounded-full text-[0.6rem] font-bold text-white ring-2 ring-white"
            style={{ background: "linear-gradient(135deg, #655975, #A495B4)" }}
          >
            S
          </div>
        </div>
        <div>
          <div className="text-sm font-semibold" style={{ color: "#2D1810" }}>Your Sakhiyaan</div>
          <div className="text-xs" style={{ color: "#8c706f" }}>Noor, Ruhi &amp; Saahi are typing...</div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex flex-col gap-3">
        {MESSAGES.slice(0, visibleCount).map((msg, i) => (
          <div
            key={i}
            className="transition-all duration-500"
            style={{ animation: "fadeSlideUp 0.5s ease-out" }}
          >
            {msg.sender !== "user" ? (
              <div className="flex gap-2">
                <div
                  className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[0.6rem] font-bold text-white"
                  style={{ background: msg.gradient }}
                >
                  {msg.initial}
                </div>
                <div>
                  <div className="mb-1 text-[0.7rem] font-semibold" style={{ color: msg.color }}>
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
  );
}
