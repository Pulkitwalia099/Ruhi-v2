export function FinalCta() {
  return (
    <section className="px-6 py-20" style={{ background: "linear-gradient(180deg, #F9F2EF, #FFF8F5)" }}>
      <div className="mx-auto max-w-xl text-center">
        <h2
          className="mb-3 font-[var(--font-heading)] text-4xl font-bold leading-tight"
          style={{ color: "#2D1810" }}
        >
          Ready to enter your sanctuary?
        </h2>
        <p className="mb-8 text-lg leading-relaxed" style={{ color: "#584140" }}>
          Noor is waiting to get to know you. Start a conversation — it only takes a message. 💬
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <a
            href={process.env.NEXT_PUBLIC_TELEGRAM_BOT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full px-8 py-4 text-lg font-semibold text-white"
            style={{
              background: "linear-gradient(135deg, #AE2F34, #FF6B6B)",
              boxShadow: "0 8px 24px rgba(174,47,52,0.25)",
            }}
          >
            💬 Chat with Noor on Telegram
          </a>
          <a
            href="/chat"
            className="rounded-full px-8 py-4 text-lg font-medium"
            style={{
              backgroundColor: "rgba(232,225,222,0.6)",
              backdropFilter: "blur(10px)",
              color: "#2D1810",
            }}
          >
            Try Web Demo
          </a>
        </div>
      </div>
    </section>
  );
}
