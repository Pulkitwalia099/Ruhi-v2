// src/components/landing/chat-preview.tsx
"use client";

import { useEffect, useRef, useState } from "react";

interface ChatMessage {
  sender: string;
  label?: string;
  color?: string;
  gradient?: string;
  initial?: string;
  text: string;
}

const MESSAGES: ChatMessage[] = [
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
];

export function ChatPreview() {
  const [visibleCount, setVisibleCount] = useState(0);
  const [typingSender, setTypingSender] = useState<string | null>(null);
  const [inputText, setInputText] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
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

  // Auto-scroll messages area when new messages appear
  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [visibleCount, typingSender, inputText]);

  function animateMessages() {
    let i = 0;
    function showNext() {
      if (i >= MESSAGES.length) {
        setTypingSender(null);
        setInputText("");
        return;
      }

      const msg = MESSAGES[i];

      if (msg.sender === "user") {
        // Simulate Priya typing in the input box
        setTypingSender(null);
        const fullText = msg.text;
        let charIndex = 0;
        setInputText("");

        const typeInterval = setInterval(() => {
          charIndex++;
          setInputText(fullText.slice(0, charIndex));
          if (charIndex >= fullText.length) {
            clearInterval(typeInterval);
            // "Send" the message after a brief pause
            setTimeout(() => {
              setInputText("");
              setVisibleCount(i + 1);
              i++;
              if (i < MESSAGES.length) {
                setTimeout(showNext, 600);
              }
            }, 500);
          }
        }, 30);
      } else {
        // Show companion typing indicator
        setTypingSender(msg.sender);
        setTimeout(() => {
          setTypingSender(null);
          setVisibleCount(i + 1);
          i++;
          if (i < MESSAGES.length) {
            setTimeout(showNext, 600);
          }
        }, 1800);
      }
    }
    setTimeout(showNext, 500);
  }

  // Get the typing indicator info for the current sender
  const typingMsg = typingSender
    ? MESSAGES.find((m) => m.sender === typingSender)
    : null;

  return (
    <div
      ref={containerRef}
      className="flex flex-col overflow-hidden rounded-3xl"
      style={{
        backgroundColor: "#FFFFFF",
        boxShadow: "0 24px 48px rgba(29,27,26,0.06)",
        height: "480px",
      }}
    >
      {/* Chat header */}
      <div
        className="flex items-center justify-between px-5 py-3"
        style={{ borderBottom: "1px solid #F9F2EF" }}
      >
        <div className="flex items-center gap-3">
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
            <div className="text-sm font-semibold" style={{ color: "#2D1810" }}>
              Your Sakhiyaan
            </div>
            <div className="text-[0.7rem]" style={{ color: "#8c706f" }}>
              {typingSender
                ? `${typingMsg?.label?.split(" · ")[0]} is typing...`
                : "Noor, Ruhi & Saahi · Online"}
            </div>
          </div>
        </div>
        {/* Menu dots */}
        <div className="flex flex-col gap-0.5">
          <span className="block h-1 w-1 rounded-full" style={{ backgroundColor: "#8c706f" }} />
          <span className="block h-1 w-1 rounded-full" style={{ backgroundColor: "#8c706f" }} />
          <span className="block h-1 w-1 rounded-full" style={{ backgroundColor: "#8c706f" }} />
        </div>
      </div>

      {/* Messages area — fixed height, scrollable */}
      <div
        ref={messagesRef}
        className="flex flex-1 flex-col gap-3 overflow-y-auto px-5 py-4"
        style={{ scrollBehavior: "smooth" }}
      >
        {MESSAGES.slice(0, visibleCount).map((msg, i) => (
          <div
            key={i}
            style={{ animation: "fadeSlideUp 0.4s ease-out" }}
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
                  <div className="mb-1 text-[0.65rem] font-semibold" style={{ color: msg.color }}>
                    {msg.label}
                  </div>
                  <div
                    className="rounded-2xl rounded-bl-sm px-3.5 py-2.5 text-[0.82rem] leading-relaxed"
                    style={{ backgroundColor: "#F9F2EF", color: "#2D1810" }}
                  >
                    {msg.text}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex justify-end">
                <div
                  className="max-w-[80%] rounded-2xl rounded-br-sm px-3.5 py-2.5 text-[0.82rem] leading-relaxed text-white"
                  style={{ background: "linear-gradient(135deg, #AE2F34, #FF6B6B)" }}
                >
                  {msg.text}
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Companion typing indicator */}
        {typingSender && typingMsg && (
          <div className="flex items-center gap-2" style={{ animation: "fadeSlideUp 0.3s ease-out" }}>
            <div
              className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[0.6rem] font-bold text-white"
              style={{ background: typingMsg.gradient }}
            >
              {typingMsg.initial}
            </div>
            <div
              className="flex items-center gap-1.5 rounded-full px-4 py-2"
              style={{ backgroundColor: "#F9F2EF" }}
            >
              <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "#8c706f", animation: "typingDot 1.2s infinite 0s" }} />
              <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "#8c706f", animation: "typingDot 1.2s infinite 0.2s" }} />
              <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "#8c706f", animation: "typingDot 1.2s infinite 0.4s" }} />
            </div>
          </div>
        )}
      </div>

      {/* Input bar — Telegram-style */}
      <div
        className="flex items-center gap-2 px-4 py-3"
        style={{ borderTop: "1px solid #F9F2EF" }}
      >
        {/* Attach button */}
        <button
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: "#F9F2EF", color: "#8c706f" }}
          aria-label="Attach"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>

        {/* Text input */}
        <div
          className="flex flex-1 items-center rounded-full px-4 py-2 text-[0.82rem]"
          style={{ backgroundColor: "#F9F2EF", color: inputText ? "#2D1810" : "#8c706f", minHeight: "36px" }}
        >
          {inputText || "Ask your Sakhiyaan..."}
        </div>

        {/* Send button */}
        <button
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-white"
          style={{
            background: inputText
              ? "linear-gradient(135deg, #AE2F34, #FF6B6B)"
              : "#E8E1DE",
            transition: "background 0.3s ease",
          }}
          aria-label="Send"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
