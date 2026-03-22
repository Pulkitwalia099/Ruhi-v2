const DOMAINS = [
  { emoji: "🩸", label: "Period Cycle", color: "#AE2F34" },
  { emoji: "🧴", label: "Skin", color: "#006A65" },
  { emoji: "🧠", label: "Mood", color: "#655975" },
  { emoji: "🍎", label: "Nutrition", color: "#D4A574" },
  { emoji: "⚡", label: "Energy", color: "#AE2F34" },
];

const PROOF_POINTS = [
  { icon: "🔗", text: "Cross-disciplinary AI that sees the full picture" },
  { icon: "📋", text: "Evidence-based insights from clinical research" },
  { icon: "💛", text: "Real friends do the research for you" },
];

export function InterconnectedCare() {
  return (
    <section id="interconnected" className="px-6 py-20" style={{ backgroundColor: "#F9F2EF" }}>
      <div className="mx-auto grid max-w-5xl items-center gap-16 lg:grid-cols-2">
        {/* Left — Orbital diagram */}
        <div className="relative mx-auto flex h-[380px] w-[380px] items-center justify-center">
          {/* Center "Digital Sanctuary" — stays still */}
          <div
            className="z-10 flex h-28 w-28 items-center justify-center rounded-full text-center text-sm font-bold leading-tight text-white"
            style={{
              background: "linear-gradient(135deg, #AE2F34, #FF6B6B)",
              boxShadow: "0 12px 32px rgba(174,47,52,0.3)",
            }}
          >
            Digital
            <br />
            Sanctuary
          </div>

          {/* Rotating wrapper: dashed circle + pills */}
          <div
            className="absolute inset-0"
            style={{ animation: "orbitRotate 30s linear infinite" }}
          >
            {/* Dashed orbit ring */}
            <div
              className="absolute rounded-full"
              style={{ inset: "40px", border: "2px dashed #E0BFBD", opacity: 0.5 }}
            />

            {/* Domain pills — counter-rotate to stay upright */}
            {DOMAINS.map((d, i) => {
              const angle = (i * 72 - 90) * (Math.PI / 180);
              const radius = 150;
              const x = Math.cos(angle) * radius;
              const y = Math.sin(angle) * radius;
              return (
                <div
                  key={d.label}
                  className="absolute rounded-full px-3 py-2 text-xs font-medium"
                  style={{
                    left: `calc(50% + ${x}px - 52px)`,
                    top: `calc(50% + ${y}px - 16px)`,
                    backgroundColor: "#FFFFFF",
                    color: d.color,
                    boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
                    whiteSpace: "nowrap",
                    animation: "orbitRotate 30s linear infinite reverse",
                  }}
                >
                  {d.emoji} {d.label}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right — Copy */}
        <div>
          <span
            className="mb-4 inline-block rounded-full px-4 py-1.5 text-xs font-medium"
            style={{ backgroundColor: "rgba(174,47,52,0.08)", color: "#AE2F34" }}
          >
            Interconnected Care
          </span>
          <h2 className="mb-4 font-[var(--font-heading)] text-3xl font-bold" style={{ color: "#2D1810" }}>
            The Gap Between Experts
          </h2>
          <p className="mb-4 leading-relaxed" style={{ color: "#584140" }}>
            Your gynecologist looks at your cycle. Your dermatologist looks at your acne.
            Your therapist looks at your stress.{" "}
            <strong>But they rarely look at each other.</strong>
          </p>
          <p className="mb-6 leading-relaxed" style={{ color: "#584140" }}>
            Sakhiyaan connects the dots — because your cortisol spike on Wednesday is causing
            that breakout on Friday, right before your period. We&apos;re the only ones who truly
            know you, every single day.
          </p>
          <div className="flex flex-col gap-3">
            {PROOF_POINTS.map((p) => (
              <div key={p.text} className="flex items-center gap-3">
                <div
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm"
                  style={{ backgroundColor: "rgba(0,106,101,0.1)" }}
                >
                  {p.icon}
                </div>
                <span className="text-sm" style={{ color: "#2D1810" }}>{p.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
