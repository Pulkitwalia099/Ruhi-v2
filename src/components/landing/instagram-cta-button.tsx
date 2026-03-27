"use client";

interface InstagramCtaButtonProps {
  variant: "primary" | "secondary";
  size?: "default" | "large";
  className?: string;
}

const INSTAGRAM_DM_URL = "https://ig.me/m/meetsakhi";
const INSTAGRAM_PROFILE_URL = "https://www.instagram.com/meetsakhi/";

export function InstagramCtaButton({ variant, size = "default", className = "" }: InstagramCtaButtonProps) {
  const padding = size === "large" ? "px-8 py-4 text-lg" : "px-5 py-2.5 text-sm";

  function handleClick() {
    // On mobile, deep-link into Instagram DMs; on desktop, open profile
    if (window.innerWidth < 1024) {
      window.open(INSTAGRAM_DM_URL, "_blank");
    } else {
      window.open(INSTAGRAM_PROFILE_URL, "_blank");
    }
  }

  return (
    <button
      onClick={handleClick}
      className={`rounded-full font-semibold ${padding} ${className}`}
      style={
        variant === "primary"
          ? {
              background: "linear-gradient(135deg, #833AB4, #E1306C, #F77737)",
              color: "#FFFFFF",
              boxShadow: "0 8px 24px rgba(225,48,108,0.25)",
            }
          : {
              background: "transparent",
              color: "#E1306C",
              border: "2px solid #E1306C",
            }
      }
    >
      {size === "large" ? "💬 Chat with Noor on Instagram" : "Chat on Instagram"}
    </button>
  );
}
