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
const BRAND = {
  bg: "#FFF8F5",
  cardBg: "#FFFFFF",
  dark: "#2D1810",
  body: "#584140",
  muted: "#8A7B79",
  teal: "#006A65",
  tealLight: "#4ECDC4",
  red: "#AE2F34",
  redBg: "#FFF0F0",
  greenBg: "#F0FAF0",
  green: "#1B7A3D",
  border: "#E8E1DE",
  barBg: "#F3EDEA",
};

/** Score → teal/amber/red color */
function scoreColor(score: number): string {
  if (score >= 8) return BRAND.teal;
  if (score >= 5) return "#B8860B";
  return BRAND.red;
}

/** Score → background tint */
function scoreBgColor(score: number): string {
  if (score >= 8) return "#E8F7F6";
  if (score >= 5) return "#FFF8E8";
  return "#FFF0F0";
}

/** Readable zone label */
function zoneLabel(key: string): string {
  const labels: Record<string, string> = {
    forehead: "Forehead",
    t_zone: "T-Zone",
    left_cheek: "L. Cheek",
    right_cheek: "R. Cheek",
    chin: "Chin",
    jawline: "Jawline",
  };
  return labels[key] ?? key;
}

/**
 * Build a Sakhiyaan-branded skin report card PNG.
 * Standalone module — no DB or env imports.
 */
export function buildReportCardResponse(
  results: ScanResults,
  createdAt: Date,
): ImageResponse {
  const zones = Object.entries(results.zones);

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          backgroundColor: BRAND.bg,
          padding: "36px 32px",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        {/* Header bar */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 24,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* Noor avatar circle */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 36,
                height: 36,
                borderRadius: 18,
                background: `linear-gradient(135deg, ${BRAND.teal}, ${BRAND.tealLight})`,
                color: "#FFFFFF",
                fontSize: 16,
                fontWeight: 700,
              }}
            >
              N
            </div>
            <span style={{ fontSize: 18, fontWeight: 700, color: BRAND.dark }}>
              Noor Skin Report
            </span>
          </div>
          <span style={{ fontSize: 12, color: BRAND.muted }}>
            {createdAt.toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </span>
        </div>

        {/* Score card */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            backgroundColor: BRAND.cardBg,
            borderRadius: 24,
            padding: "28px 24px",
            marginBottom: 20,
            boxShadow: "0 4px 24px rgba(29,27,26,0.06)",
          }}
        >
          <span style={{ fontSize: 13, color: BRAND.muted, fontWeight: 500, marginBottom: 8 }}>
            OVERALL SKIN HEALTH
          </span>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
            <span
              style={{
                fontSize: 64,
                fontWeight: 800,
                color: scoreColor(results.overall_score),
                lineHeight: 1,
              }}
            >
              {results.overall_score}
            </span>
            <span style={{ fontSize: 24, fontWeight: 600, color: BRAND.muted }}>
              /10
            </span>
          </div>
        </div>

        {/* Zone bars card */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            backgroundColor: BRAND.cardBg,
            borderRadius: 24,
            padding: "20px 24px",
            marginBottom: 16,
            boxShadow: "0 4px 24px rgba(29,27,26,0.06)",
            gap: 12,
          }}
        >
          <span style={{ fontSize: 13, color: BRAND.muted, fontWeight: 600, marginBottom: 4 }}>
            ZONE BREAKDOWN
          </span>
          {zones.map(([key, zone]) => (
            <div
              key={key}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <span
                style={{
                  fontSize: 13,
                  color: BRAND.body,
                  width: 70,
                  fontWeight: 500,
                }}
              >
                {zoneLabel(key)}
              </span>
              {/* Bar track */}
              <div
                style={{
                  display: "flex",
                  flex: 1,
                  height: 14,
                  backgroundColor: BRAND.barBg,
                  borderRadius: 7,
                  overflow: "hidden",
                }}
              >
                {/* Bar fill */}
                <div
                  style={{
                    display: "flex",
                    width: `${zone.severity * 10}%`,
                    height: "100%",
                    borderRadius: 7,
                    background: `linear-gradient(90deg, ${scoreColor(zone.severity)}, ${scoreColor(zone.severity)}dd)`,
                  }}
                />
              </div>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: scoreColor(zone.severity),
                  width: 24,
                  textAlign: "right",
                }}
              >
                {zone.severity}
              </span>
            </div>
          ))}
        </div>

        {/* Concerns + Positives row */}
        <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
          {/* Concerns */}
          {results.key_concerns.length > 0 && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                flex: 1,
                backgroundColor: BRAND.redBg,
                borderRadius: 20,
                padding: "16px 18px",
                gap: 8,
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 700, color: BRAND.red }}>
                NEEDS ATTENTION
              </span>
              {results.key_concerns.map((c) => (
                <span key={c} style={{ fontSize: 12, color: BRAND.red, lineHeight: 1.4 }}>
                  • {c}
                </span>
              ))}
            </div>
          )}

          {/* Positives */}
          {results.positives.length > 0 && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                flex: 1,
                backgroundColor: BRAND.greenBg,
                borderRadius: 20,
                padding: "16px 18px",
                gap: 8,
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 700, color: BRAND.green }}>
                LOOKING GOOD
              </span>
              {results.positives.map((p) => (
                <span key={p} style={{ fontSize: 12, color: BRAND.green, lineHeight: 1.4 }}>
                  • {p}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            marginTop: "auto",
            paddingTop: 16,
            gap: 6,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 20,
              height: 20,
              borderRadius: 10,
              background: `linear-gradient(135deg, ${BRAND.teal}, ${BRAND.tealLight})`,
              color: "#FFFFFF",
              fontSize: 10,
              fontWeight: 700,
            }}
          >
            N
          </div>
          <span style={{ fontSize: 12, color: BRAND.muted }}>
            Powered by Sakhiyaan · t.me/SakhiyaanBot
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
