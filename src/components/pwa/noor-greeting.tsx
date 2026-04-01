import type { Cycle, Scan, Streak } from "@/db/schema";

interface NoorGreetingProps {
  scans: Scan[];
  streak: Streak | null;
  cycle: Cycle | null;
  memoriesBlock: string | null;
}

function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function buildGreeting({ scans, streak }: NoorGreetingProps): string {
  // Priority 1: Recent scan results (within 2 days)
  if (scans.length > 0) {
    const latest = scans[0];
    const daysSinceScan = Math.floor(
      (Date.now() - new Date(latest.createdAt).getTime()) /
        (1000 * 60 * 60 * 24),
    );
    const results = latest.results as Record<string, unknown> | null;
    const score = results?.overallScore;

    if (daysSinceScan <= 2 && typeof score === "number") {
      const trend =
        score >= 7 ? "looking good" : "kuch areas pe kaam karna hai";
      return `Tumhara last scan ${score}/10 aaya — ${trend}! Breakdown dekhna hai?`;
    }

    // Priority 3: Scan nudge (no scan in 7+ days)
    if (daysSinceScan >= 7) {
      return `Hey! ${daysSinceScan} din ho gaye last scan se. Let me check how things are going — selfie bhejo?`;
    }
  }

  // Priority 2: Streak milestone
  if (streak && streak.currentStreak >= 3) {
    return `${streak.currentStreak} din ka streak! Keep it going!`;
  }

  // Priority 4: General greeting
  return `${getTimeGreeting()}! Kya karna hai aaj?`;
}

export function NoorGreeting(props: NoorGreetingProps) {
  const greeting = buildGreeting(props);

  return (
    <div className="mt-6 mb-6 px-1">
      <div className="flex items-start gap-3">
        {/* Noor avatar */}
        <div
          className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-full text-sm font-semibold text-white"
          style={{
            background: "linear-gradient(135deg, #006A65, #3DB9A8)",
            boxShadow: "0 0 12px rgba(61, 185, 168, 0.2)",
          }}
        >
          N
        </div>

        {/* Greeting bubble */}
        <div
          className="max-w-[85%] px-4 py-3 text-[15px] leading-relaxed"
          style={{
            backgroundColor: "#252220",
            border: "1px solid rgba(250, 250, 249, 0.08)",
            borderRadius: "0 16px 16px 16px",
            color: "#D6D3D1",
          }}
        >
          {greeting}
        </div>
      </div>
    </div>
  );
}
