"use client";

import { useState } from "react";
import { TelegramQrModal } from "./telegram-qr-modal";

interface CtaButtonProps {
  variant: "primary" | "secondary";
  size?: "default" | "large";
  className?: string;
}

const TELEGRAM_URL = process.env.NEXT_PUBLIC_TELEGRAM_BOT_URL!;

export function TelegramCtaButton({ variant, size = "default", className = "" }: CtaButtonProps) {
  const [qrOpen, setQrOpen] = useState(false);

  const padding = size === "large" ? "px-8 py-4 text-lg" : "px-5 py-2.5 text-sm";

  function handleClick() {
    if (window.innerWidth < 1024) {
      window.open(TELEGRAM_URL, "_blank");
      return;
    }
    setQrOpen(true);
  }

  return (
    <>
      <button
        onClick={handleClick}
        className={`rounded-full font-semibold ${padding} ${className}`}
        style={
          variant === "primary"
            ? {
                background: "linear-gradient(135deg, #AE2F34, #FF6B6B)",
                color: "#FFFFFF",
                boxShadow: "0 8px 24px rgba(174,47,52,0.25)",
              }
            : undefined
        }
      >
        {size === "large" ? "💬 Chat with Noor on Telegram" : "Chat on Telegram"}
      </button>
      <TelegramQrModal open={qrOpen} onOpenChange={setQrOpen} />
    </>
  );
}
