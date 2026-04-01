"use client";

import { useRouter } from "next/navigation";

interface SuggestionChipsProps {
  hasScans: boolean;
}

const CHIPS = [
  { id: "scan", icon: "📸", label: "Scan my face", prompt: "Scan my face" },
  { id: "progress", icon: "📈", label: "My progress", prompt: "My progress" },
  { id: "product", icon: "🔍", label: "Check a product", prompt: "Check a product" },
  { id: "chat", icon: "💬", label: "Just chat", prompt: "" },
];

export function SuggestionChips({ hasScans }: SuggestionChipsProps) {
  const router = useRouter();

  const chips = CHIPS.map((chip) => {
    if (!hasScans && chip.id === "progress") {
      return { ...chip, label: "Take your first scan", prompt: "Scan my face" };
    }
    return chip;
  });

  return (
    <div className="grid grid-cols-2 gap-3 mt-2">
      {chips.map((chip) => (
        <button
          key={chip.id}
          type="button"
          onClick={() => {
            const params = chip.prompt
              ? `?prompt=${encodeURIComponent(chip.prompt)}`
              : "";
            router.push(`/${params}`);
          }}
          className="flex items-center gap-3 px-4 py-3.5 rounded-2xl text-left transition-colors active:scale-[0.98]"
          style={{
            backgroundColor: "#252220",
            border: "1px solid rgba(250, 250, 249, 0.08)",
          }}
        >
          <span className="text-lg flex-shrink-0">{chip.icon}</span>
          <span className="text-[14px] font-medium" style={{ color: "#D6D3D1" }}>
            {chip.label}
          </span>
        </button>
      ))}
    </div>
  );
}
