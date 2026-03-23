import { ImageResponse } from "next/og";

interface ZoneData {
  condition: string;
  severity: number;
  clinical_notes: string;
}

export interface ScanResults {
  zones: Record<string, ZoneData>;
  overall_score: number;
  key_concerns: string[];
  positives: string[];
}

// ---- Sakhiyaan warm brand palette (matches landing page) ----
const B = {
  bg: "#FFF8F5",
  cardBg: "#FFFFFF",
  cardBorder: "#F3EAE5",
  brown: "#2D1810",
  brownMid: "#584140",
  brownLight: "#8c706f",
  blush: "#F9F2EF",
  teal: "#006A65",
  tealLight: "#4ECDC4",
  coral: "#AE2F34",
  coralLight: "#FF6B6B",
  amber: "#E8A830",
  redSoft: "#FFF0F0",
  redText: "#C0392B",
  greenSoft: "#F0FAF9",
  greenText: "#006A65",
};

/** Score → color (warm palette) */
function scoreColor(s: number): string {
  if (s >= 8) return B.teal;
  if (s >= 5) return B.amber;
  return B.coral;
}

/** Score → gradient for the score circle ring */
function scoreGradient(s: number): string {
  if (s >= 8) return "linear-gradient(135deg, #006A65, #4ECDC4)";
  if (s >= 5) return "linear-gradient(135deg, #E8A830, #F0D060)";
  return "linear-gradient(135deg, #AE2F34, #FF6B6B)";
}

/** Score → verdict (fun, shareable badge text) */
function getVerdict(s: number): { text: string; emoji: string } {
  if (s >= 9) {
    const opts = [
      { text: "Glow Queen", emoji: "👑" },
      { text: "Skin Goals", emoji: "💅" },
      { text: "Flawless Era", emoji: "🔥" },
    ];
    return opts[s % opts.length];
  }
  if (s >= 7) {
    const opts = [
      { text: "Almost There", emoji: "✨" },
      { text: "Glowing Up", emoji: "🌟" },
      { text: "Looking Good", emoji: "💫" },
    ];
    return opts[s % opts.length];
  }
  if (s >= 5) {
    const opts = [
      { text: "Work in Progress", emoji: "🌱" },
      { text: "Building Your Glow", emoji: "🧴" },
      { text: "Glow Up Loading", emoji: "⏳" },
    ];
    return opts[s % opts.length];
  }
  const opts = [
    { text: "Fresh Start", emoji: "🚀" },
    { text: "Your Glow Journey Begins", emoji: "🌿" },
    { text: "Time to Glow Up", emoji: "💪" },
  ];
  return opts[s % opts.length];
}

/** Score → personalized headline + emoji */
function getHeadline(s: number): { text: string; highlight: string; emoji: string } {
  if (s >= 9) return { text: "You're literally", highlight: "glowing!", emoji: "🔥" };
  if (s >= 7) return { text: "Bestie, your skin is", highlight: "thriving!", emoji: "💅" };
  if (s >= 5) return { text: "Your glow up is", highlight: "in progress!", emoji: "🌱" };
  return { text: "Your glow journey", highlight: "starts now!", emoji: "🚀" };
}

/** Build emoji bar: emoji count = score (1-10), spaced with gaps */
function emojiBar(score: number, emoji: string): string {
  const count = Math.max(1, Math.min(10, score));
  return Array(count).fill(emoji).join("  ");
}

/**
 * Derive higher-level metrics from zone data.
 */
function deriveMetrics(results: ScanResults) {
  const zones = Object.values(results.zones);
  const avg = (arr: number[]) => Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);

  const hydrationScores = zones.map((z) =>
    z.condition.toLowerCase().includes("dry") ? Math.max(2, z.severity - 2) : z.severity,
  );
  const hydration = avg(hydrationScores);

  const glowBase = results.overall_score;
  const glowBoost = Math.min(results.positives.length, 2);
  const glow = Math.min(10, Math.max(1, glowBase + glowBoost - 1));

  const acneScores = zones.map((z) =>
    z.condition.toLowerCase().includes("acne") ? z.severity : Math.min(10, z.severity + 2),
  );
  const acneControl = avg(acneScores);

  const texture = avg(zones.map((z) => z.severity));

  return { hydration, glow, acneControl, texture };
}

/**
 * Sakhiyaan skin report card — dopamine-inducing Insta aesthetic.
 * 1080×1350 (4:5), dynamic colors, fun verdicts, personalized headlines.
 */
export function buildReportCardResponse(
  results: ScanResults,
  createdAt: Date,
): ImageResponse {
  const m = deriveMetrics(results);
  const verdict = getVerdict(results.overall_score);
  const headline = getHeadline(results.overall_score);

  const metrics = [
    { label: "Hydration", emoji: "💧", score: m.hydration },
    { label: "Glow Factor", emoji: "✨", score: m.glow },
    { label: "Clarity", emoji: "🫧", score: m.acneControl },
    { label: "Texture", emoji: "🪷", score: m.texture },
  ];

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          background: `linear-gradient(180deg, ${B.bg} 0%, #FFF2EC 100%)`,
          padding: "48px 52px 40px",
          fontFamily: "Inter, system-ui, sans-serif",
          position: "relative",
        }}
      >
        {/* Decorative blush orb — top right */}
        <div
          style={{
            display: "flex",
            position: "absolute",
            top: -150,
            right: -80,
            width: 600,
            height: 600,
            borderRadius: 300,
            background: "radial-gradient(circle, rgba(174,47,52,0.08) 0%, transparent 70%)",
          }}
        />
        {/* Decorative teal orb — bottom left */}
        <div
          style={{
            display: "flex",
            position: "absolute",
            bottom: -120,
            left: -80,
            width: 550,
            height: 550,
            borderRadius: 275,
            background: "radial-gradient(circle, rgba(0,106,101,0.06) 0%, transparent 70%)",
          }}
        />

        {/* ─── Header ─── */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 28,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 68,
                height: 68,
                borderRadius: 34,
                background: "linear-gradient(135deg, #006A65, #4ECDC4)",
                fontSize: 30,
                fontWeight: 700,
                color: "#FFFFFF",
              }}
            >
              N
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span
                style={{
                  fontSize: 40,
                  fontWeight: 800,
                  color: B.brown,
                  letterSpacing: "-0.02em",
                }}
              >
                Skin Report Card
              </span>
              <span style={{ fontSize: 22, color: B.brownLight, fontWeight: 500 }}>
                by Noor · your skin bestie
              </span>
            </div>
          </div>
          <span style={{ fontSize: 24, color: B.brownLight, fontWeight: 500 }}>
            {createdAt.toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </span>
        </div>

        {/* ─── Personalized headline ─── */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            marginBottom: 20,
            gap: 10,
          }}
        >
          <span style={{ fontSize: 30, fontWeight: 700, color: B.brownMid }}>
            {headline.text}
          </span>
          <span
            style={{
              fontSize: 30,
              fontWeight: 800,
              color: scoreColor(results.overall_score),
            }}
          >
            {headline.highlight}
          </span>
          <span style={{ fontSize: 30 }}>{headline.emoji}</span>
        </div>

        {/* ─── Score circle — dynamic gradient ─── */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            marginBottom: 8,
            position: "relative",
          }}
        >
          {/* Sparkle decorations */}
          <span style={{ display: "flex", position: "absolute", top: 10, left: 340, fontSize: 32 }}>✨</span>
          <span style={{ display: "flex", position: "absolute", top: 60, right: 340, fontSize: 24 }}>✨</span>
          <span style={{ display: "flex", position: "absolute", bottom: 60, left: 360, fontSize: 20 }}>💫</span>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 260,
              height: 260,
              borderRadius: 130,
              background: scoreGradient(results.overall_score),
              padding: 9,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 242,
                height: 242,
                borderRadius: 121,
                backgroundColor: B.bg,
              }}
            >
              <div style={{ display: "flex", alignItems: "baseline" }}>
                <span
                  style={{
                    fontSize: 120,
                    fontWeight: 800,
                    color: scoreColor(results.overall_score),
                    lineHeight: 1,
                    letterSpacing: "-0.05em",
                  }}
                >
                  {results.overall_score}
                </span>
                <span style={{ fontSize: 38, fontWeight: 500, color: B.brownLight }}>
                  /10
                </span>
              </div>
            </div>
          </div>

          {/* ─── Verdict badge ─── */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginTop: -20,
              background: scoreGradient(results.overall_score),
              borderRadius: 50,
              padding: "10px 28px",
              gap: 8,
            }}
          >
            <span style={{ fontSize: 22, fontWeight: 800, color: "#FFFFFF" }}>
              {verdict.emoji} {verdict.text}
            </span>
          </div>
        </div>

        {/* ─── Metrics — each row is its own card ─── */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            marginTop: 20,
            marginBottom: 18,
          }}
        >
          {metrics.map((met) => (
            <div
              key={met.label}
              style={{
                display: "flex",
                alignItems: "center",
                backgroundColor: B.cardBg,
                border: `2px solid ${B.cardBorder}`,
                borderRadius: 28,
                padding: "24px 32px",
              }}
            >
              <span
                style={{
                  fontSize: 36,
                  color: scoreColor(met.score),
                  fontWeight: 800,
                  width: 220,
                  letterSpacing: "-0.02em",
                }}
              >
                {met.label}
              </span>
              <span
                style={{
                  display: "flex",
                  flex: 1,
                  fontSize: 44,
                  letterSpacing: 7,
                  justifyContent: "flex-start",
                }}
              >
                {emojiBar(met.score, met.emoji)}
              </span>
              <span
                style={{
                  fontSize: 42,
                  fontWeight: 800,
                  color: scoreColor(met.score),
                  width: 64,
                  textAlign: "right",
                }}
              >
                {met.score}
              </span>
            </div>
          ))}
        </div>

        {/* ─── Concerns + Wins ─── */}
        <div style={{ display: "flex", gap: 16, marginBottom: 10 }}>
          {results.key_concerns.length > 0 && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                flex: 1,
                backgroundColor: B.redSoft,
                border: "2px solid #FADCDC",
                borderRadius: 24,
                padding: "22px 26px",
                gap: 10,
              }}
            >
              <span
                style={{
                  fontSize: 20,
                  fontWeight: 800,
                  color: B.coral,
                  letterSpacing: 1.5,
                  textTransform: "uppercase" as const,
                }}
              >
                🎯 Focus Areas
              </span>
              {results.key_concerns.slice(0, 2).map((c) => (
                <span
                  key={c}
                  style={{
                    fontSize: 22,
                    color: B.redText,
                    lineHeight: 1.4,
                    fontWeight: 500,
                  }}
                >
                  • {c}
                </span>
              ))}
            </div>
          )}
          {results.positives.length > 0 && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                flex: 1,
                backgroundColor: B.greenSoft,
                border: "2px solid #C8E6E3",
                borderRadius: 24,
                padding: "22px 26px",
                gap: 10,
              }}
            >
              <span
                style={{
                  fontSize: 20,
                  fontWeight: 800,
                  color: B.teal,
                  letterSpacing: 1.5,
                  textTransform: "uppercase" as const,
                }}
              >
                💪 Your Wins
              </span>
              {results.positives.slice(0, 2).map((p) => (
                <span
                  key={p}
                  style={{
                    fontSize: 22,
                    color: B.teal,
                    lineHeight: 1.4,
                    fontWeight: 500,
                  }}
                >
                  • {p}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ─── CTA Footer ─── */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            marginTop: "auto",
            paddingTop: 6,
            gap: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "linear-gradient(135deg, #AE2F34, #FF6B6B)",
              borderRadius: 60,
              padding: "22px 56px",
            }}
          >
            <span style={{ fontSize: 28, fontWeight: 700, color: "#FFFFFF" }}>
              Get your free report on meetSakhi.com ✨
            </span>
          </div>
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1350,
    },
  );
}
