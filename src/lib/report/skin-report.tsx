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

// ---- Sakhiyaan brand palette ----
const B = {
  bg: "#0F1923",
  cardBg: "rgba(255,255,255,0.06)",
  cardBorder: "rgba(255,255,255,0.08)",
  white: "#FFFFFF",
  light: "#E8F0F0",
  muted: "#8BA4A3",
  teal: "#4ECDC4",
  tealDark: "#006A65",
  amber: "#F0B860",
  red: "#E85D5D",
  redSoft: "rgba(232,93,93,0.12)",
  greenSoft: "rgba(78,205,196,0.12)",
};

/** Score → color */
function scoreColor(s: number): string {
  if (s >= 8) return B.teal;
  if (s >= 5) return B.amber;
  return B.red;
}

/** Build emoji bar: filled + empty dots */
function emojiBar(score: number, emoji: string): string {
  const filled = Math.round(score / 2); // 1-10 → 0-5 dots
  const empty = 5 - filled;
  return emoji.repeat(filled) + "░".repeat(empty);
}

/**
 * Derive higher-level metrics from zone data.
 * These are more interesting/shareable than raw zone scores.
 */
function deriveMetrics(results: ScanResults) {
  const zones = Object.values(results.zones);
  const avg = (arr: number[]) => Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);

  // Hydration: inverse of dryness across zones
  const hydrationScores = zones.map((z) =>
    z.condition.toLowerCase().includes("dry") ? Math.max(2, z.severity - 2) : z.severity,
  );
  const hydration = avg(hydrationScores);

  // Glow: boosted by positives, penalized by concerns
  const glowBase = results.overall_score;
  const glowBoost = Math.min(results.positives.length, 2);
  const glow = Math.min(10, Math.max(1, glowBase + glowBoost - 1));

  // Acne control: zones with acne get penalized
  const acneScores = zones.map((z) =>
    z.condition.toLowerCase().includes("acne") ? z.severity : Math.min(10, z.severity + 2),
  );
  const acneControl = avg(acneScores);

  // Texture: direct from zone severity
  const texture = avg(zones.map((z) => z.severity));

  // Barrier: sensitive/redness signals
  const barrierScores = zones.map((z) =>
    z.condition.toLowerCase().includes("red") || z.condition.toLowerCase().includes("inflam")
      ? Math.max(2, z.severity - 1)
      : z.severity,
  );
  const barrier = avg(barrierScores);

  return { hydration, glow, acneControl, texture, barrier };
}

/**
 * Sakhiyaan skin report card — glow aesthetic + emoji bars.
 */
export function buildReportCardResponse(
  results: ScanResults,
  createdAt: Date,
): ImageResponse {
  const m = deriveMetrics(results);

  const metrics = [
    { label: "Hydration", emoji: "💧", score: m.hydration },
    { label: "Glow", emoji: "✨", score: m.glow },
    { label: "Acne Control", emoji: "🔴", score: m.acneControl },
    { label: "Texture", emoji: "🧱", score: m.texture },
    { label: "Barrier", emoji: "🛡", score: m.barrier },
  ];

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          background: `radial-gradient(ellipse at 50% 0%, #0D3B3A 0%, ${B.bg} 60%)`,
          padding: "40px 32px 32px",
          fontFamily: "Inter, system-ui, sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Glow orb — top center */}
        <div
          style={{
            display: "flex",
            position: "absolute",
            top: -60,
            left: "50%",
            width: 300,
            height: 300,
            borderRadius: 150,
            background: `radial-gradient(circle, ${B.teal}33 0%, transparent 70%)`,
            transform: "translateX(-50%)",
          }}
        />

        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 28,
          }}
        >
          <span style={{ fontSize: 15, fontWeight: 700, color: B.teal, letterSpacing: 1.5 }}>
            ✨ SKIN REPORT CARD
          </span>
          <span style={{ fontSize: 12, color: B.muted }}>
            {createdAt.toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </span>
        </div>

        {/* Score circle with glow */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            marginBottom: 28,
          }}
        >
          {/* Outer glow ring */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 130,
              height: 130,
              borderRadius: 65,
              background: `conic-gradient(${scoreColor(results.overall_score)} ${results.overall_score * 10}%, ${B.cardBg} 0%)`,
              boxShadow: `0 0 40px ${scoreColor(results.overall_score)}44`,
            }}
          >
            {/* Inner circle */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                width: 108,
                height: 108,
                borderRadius: 54,
                backgroundColor: B.bg,
              }}
            >
              <div style={{ display: "flex", alignItems: "baseline" }}>
                <span style={{ fontSize: 48, fontWeight: 800, color: B.white, lineHeight: 1 }}>
                  {results.overall_score}
                </span>
                <span style={{ fontSize: 18, fontWeight: 500, color: B.muted }}>
                  /10
                </span>
              </div>
            </div>
          </div>
          <span style={{ fontSize: 12, color: B.muted, marginTop: 10, fontWeight: 500 }}>
            YOUR SKIN SCORE
          </span>
        </div>

        {/* Metrics card with emoji bars */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            backgroundColor: B.cardBg,
            border: `1px solid ${B.cardBorder}`,
            borderRadius: 20,
            padding: "20px 22px",
            marginBottom: 16,
            gap: 14,
          }}
        >
          {metrics.map((met) => (
            <div
              key={met.label}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span style={{ fontSize: 13, color: B.light, fontWeight: 500, width: 95 }}>
                {met.label}
              </span>
              <span style={{ fontSize: 14, letterSpacing: 2 }}>
                {emojiBar(met.score, met.emoji)}
              </span>
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: scoreColor(met.score),
                  width: 24,
                  textAlign: "right",
                }}
              >
                {met.score}
              </span>
            </div>
          ))}
        </div>

        {/* Concerns + Wins side by side */}
        <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
          {results.key_concerns.length > 0 && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                flex: 1,
                backgroundColor: B.redSoft,
                borderRadius: 16,
                padding: "14px 16px",
                gap: 6,
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 700, color: B.red }}>
                🎯 PRIORITY
              </span>
              {results.key_concerns.slice(0, 2).map((c) => (
                <span key={c} style={{ fontSize: 11, color: B.red, lineHeight: 1.4 }}>
                  {c}
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
                borderRadius: 16,
                padding: "14px 16px",
                gap: 6,
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 700, color: B.teal }}>
                💪 WINS
              </span>
              {results.positives.slice(0, 2).map((p) => (
                <span key={p} style={{ fontSize: 11, color: B.teal, lineHeight: 1.4 }}>
                  {p}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* CTA Footer */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            marginTop: "auto",
            paddingTop: 16,
            gap: 6,
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 600, color: B.teal }}>
            Get your free skin report →
          </span>
          <span style={{ fontSize: 12, color: B.muted }}>
            t.me/Ruhi_Sahki_Bot
          </span>
        </div>
      </div>
    ),
    {
      width: 540,
      height: 960,
    },
  );
}
