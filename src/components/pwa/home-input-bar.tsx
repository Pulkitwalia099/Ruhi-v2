"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function HomeInputBar() {
  const [text, setText] = useState("");
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    router.push(`/?message=${encodeURIComponent(trimmed)}`);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="fixed bottom-0 left-0 right-0 px-4 py-3 backdrop-blur-md"
      style={{ backgroundColor: "rgba(26, 24, 21, 0.92)" }}
    >
      <div
        className="flex items-center gap-2 px-4 py-2.5 rounded-full"
        style={{
          backgroundColor: "#252220",
          border: "1px solid rgba(250, 250, 249, 0.08)",
        }}
      >
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ask Noor anything..."
          className="flex-1 bg-transparent text-[15px] outline-none placeholder:text-[#78716C]"
          style={{ color: "#FAFAF9" }}
        />

        {/* Mic button */}
        <button
          type="button"
          className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full transition-colors"
          style={{ color: "#A8A29E" }}
          aria-label="Voice input"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" x2="12" y1="19" y2="22" />
          </svg>
        </button>

        {/* Send button — appears when text is entered */}
        {text.trim() && (
          <button
            type="submit"
            className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full transition-transform active:scale-90"
            style={{ backgroundColor: "#E8655A" }}
            aria-label="Send message"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" x2="11" y1="2" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        )}
      </div>
    </form>
  );
}
