const TESTIMONIALS = [
  {
    quote: "Noor told me my breakouts were linked to my cycle phase. My dermatologist never mentioned that!",
    name: "Priya, 24",
    city: "Mumbai",
    initial: "P",
  },
  {
    quote: "It's like having a bestie who actually studied dermatology. Hinglish mein baat karna makes it feel so natural 💛",
    name: "Ananya, 28",
    city: "Delhi",
    initial: "A",
  },
  {
    quote: "Finally someone who connects the dots. Noor saw that my stress was causing my skin issues before I did.",
    name: "Meera, 22",
    city: "Bangalore",
    initial: "M",
  },
];

export function SocialProof() {
  return (
    <section className="px-6 py-20" style={{ backgroundColor: "#FFF8F5" }}>
      <div className="mx-auto max-w-4xl text-center">
        <h2 className="mb-2 font-[var(--font-heading)] text-3xl font-bold" style={{ color: "#2D1810" }}>
          Trusted by Women Across India
        </h2>
        <p className="mb-10" style={{ color: "#584140" }}>
          Real stories from women who chat with Noor every day.
        </p>
        <div className="grid gap-5 md:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <div
              key={t.name}
              className="rounded-3xl p-6 text-left"
              style={{ backgroundColor: "#FFFFFF", boxShadow: "0 12px 32px rgba(29,27,26,0.04)" }}
            >
              <p className="mb-4 text-sm leading-relaxed" style={{ color: "#584140" }}>
                &ldquo;{t.quote}&rdquo;
              </p>
              <div className="flex items-center gap-2">
                <div
                  className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold"
                  style={{ backgroundColor: "#F9F2EF", color: "#584140" }}
                >
                  {t.initial}
                </div>
                <div>
                  <div className="text-xs font-semibold" style={{ color: "#2D1810" }}>{t.name}</div>
                  <div className="text-[0.7rem]" style={{ color: "#8c706f" }}>{t.city}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
