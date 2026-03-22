// src/components/landing/nav.tsx
export function LandingNav() {
  return (
    <nav className="sticky top-0 z-50 backdrop-blur-md" style={{ backgroundColor: "rgba(255,248,245,0.85)" }}>
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <a href="#" className="font-[var(--font-heading)] text-xl font-bold" style={{ color: "#2D1810" }}>
          Sakhiyaan
        </a>

        <div className="hidden items-center gap-8 md:flex">
          <a href="#companions" className="text-sm font-medium" style={{ color: "#584140" }}>
            Meet Noor
          </a>
          <a href="#interconnected" className="text-sm font-medium" style={{ color: "#584140" }}>
            About
          </a>
          <a
            href={process.env.NEXT_PUBLIC_TELEGRAM_BOT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full px-5 py-2.5 text-sm font-semibold text-white"
            style={{ background: "linear-gradient(135deg, #AE2F34, #FF6B6B)" }}
          >
            Chat on Telegram
          </a>
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
