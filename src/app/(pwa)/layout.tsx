import type { ReactNode } from "react";

export const metadata = {
  title: "Sakhiyaan — Noor's Space",
  manifest: "/manifest.json",
};

export const viewport = {
  themeColor: "#1A1815",
};

export default function PWALayout({ children }: { children: ReactNode }) {
  return (
    <div
      className="min-h-dvh font-[family-name:var(--font-dm-sans)]"
      style={{ backgroundColor: "#1A1815", color: "#FAFAF9" }}
    >
      {children}
    </div>
  );
}
