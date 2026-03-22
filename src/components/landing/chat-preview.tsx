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

      <div
        className="mx-auto max-w-[680px] rounded-3xl p-6"
        style={{ backgroundColor: "#FFFFFF", boxShadow: "0 24px 48px rgba(29,27,26,0.06)" }}
      >
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

        <div className="flex flex-col gap-3">
          {MESSAGES.slice(0, visibleCount).map((msg, i) => (
            <div
              key={i}
              className="transition-all duration-500"
              style={{ animation: "fadeSlideUp 0.5s ease-out" }}
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
