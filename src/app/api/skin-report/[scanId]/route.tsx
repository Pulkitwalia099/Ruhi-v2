import { ImageResponse } from "next/og";

import { getScanById } from "@/db/queries";
import { env } from "@/lib/env";

// Node.js runtime — Drizzle ORM needs Node, and ImageResponse works here too
export const runtime = "nodejs";

interface ZoneData {
  condition: string;
  severity: number;
  clinical_notes: string;
}

interface ScanResults {
  zones: Record<string, ZoneData>;
  overall_score: number;
  key_concerns: string[];
  positives: string[];
}

/** Color for a severity score: red < 5, yellow 5-7, green > 7 */
function scoreColor(score: number): string {
  if (score >= 8) return "#22c55e";
  if (score >= 5) return "#eab308";
  return "#ef4444";
}

/** Readable zone label */
function zoneLabel(key: string): string {
  const labels: Record<string, string> = {
    forehead: "Forehead",
    t_zone: "T-Zone",
    left_cheek: "Left Cheek",
    right_cheek: "Right Cheek",
    chin: "Chin",
    jawline: "Jawline",
  };
  return labels[key] ?? key;
}

/**
 * Build the report card JSX for a given scan result.
 * Exported so the Telegram handler can call it directly
 * (avoids self-fetch deadlock in serverless).
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
          backgroundColor: "#0a0a0a",
          color: "#ffffff",
          padding: "30px",
          fontFamily: "Inter, sans-serif",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: 22, fontWeight: 700 }}>
            NOOR SKIN REPORT
          </span>
          <span style={{ fontSize: 14, color: "#888888" }}>
            {createdAt.toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </span>
        </div>

        {/* Overall Score */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            marginTop: 25,
            marginBottom: 20,
          }}
        >
          <span
            style={{
              fontSize: 56,
              fontWeight: 800,
              color: scoreColor(results.overall_score),
            }}
          >
            {results.overall_score}/10
          </span>
          <span style={{ fontSize: 14, color: "#aaaaaa", marginTop: 4 }}>
            Overall Skin Score
          </span>
        </div>

        {/* Zone Bars */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            marginBottom: 20,
          }}
        >
          {zones.map(([key, zone]) => (
            <div
              key={key}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
              }}
            >
              <span
                style={{
                  fontSize: 18,
                  color: "#cccccc",
                  width: 90,
                  textAlign: "right",
                }}
              >
                {zoneLabel(key)}
              </span>
              {/* Bar background */}
              <div
                style={{
                  display: "flex",
                  width: 280,
                  height: 18,
                  backgroundColor: "#1a1a1a",
                  borderRadius: 9,
                  overflow: "hidden",
                }}
              >
                {/* Bar fill */}
                <div
                  style={{
                    display: "flex",
                    width: `${zone.severity * 10}%`,
                    height: "100%",
                    backgroundColor: scoreColor(zone.severity),
                    borderRadius: 9,
                  }}
                />
              </div>
              <span
                style={{
                  fontSize: 18,
                  fontWeight: 600,
                  color: scoreColor(zone.severity),
                  width: 40,
                }}
              >
                {zone.severity}
              </span>
            </div>
          ))}
        </div>

        {/* Key Concerns */}
        {results.key_concerns.length > 0 && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              marginBottom: 30,
            }}
          >
            <span
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: "#ef4444",
                marginBottom: 10,
              }}
            >
              Needs Attention
            </span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {results.key_concerns.map((concern) => (
                <span
                  key={concern}
                  style={{
                    display: "flex",
                    fontSize: 16,
                    backgroundColor: "#1c1017",
                    color: "#f87171",
                    padding: "8px 16px",
                    borderRadius: 20,
                    border: "1px solid #7f1d1d",
                  }}
                >
                  {concern}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Positives */}
        {results.positives.length > 0 && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              marginBottom: 30,
            }}
          >
            <span
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: "#22c55e",
                marginBottom: 10,
              }}
            >
              Looking Good
            </span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {results.positives.map((positive) => (
                <span
                  key={positive}
                  style={{
                    display: "flex",
                    fontSize: 16,
                    backgroundColor: "#0a1a0f",
                    color: "#4ade80",
                    padding: "8px 16px",
                    borderRadius: 20,
                    border: "1px solid #14532d",
                  }}
                >
                  {positive}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Footer with referral */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginTop: "auto",
            paddingTop: 24,
            borderTop: "1px solid #333333",
          }}
        >
          <span style={{ fontSize: 18, color: "#666666" }}>
            Get your skin analyzed → t.me/SakhiyaanBot
          </span>
        </div>
      </div>
    ),
    {
      // Half of Instagram story size — keeps PNG under ~1MB
      // while still looking crisp on mobile screens
      width: 540,
      height: 960,
    },
  );
}

/**
 * Public API route — protected by CRON_SECRET to prevent
 * unauthorized access to clinical skin data.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ scanId: string }> },
) {
  // Auth: only allow internal/bot requests with the shared secret
  const authHeader = request.headers.get("authorization");
  const expectedToken = env.CRON_SECRET;
  if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const { scanId } = await params;
    const scan = await getScanById({ id: scanId });

    if (!scan) {
      return new Response("Scan not found", { status: 404 });
    }

    const results = scan.results as unknown as ScanResults;
    if (!results?.zones || !results?.overall_score) {
      return new Response("Invalid scan data", { status: 422 });
    }

    return buildReportCardResponse(results, scan.createdAt);
  } catch (error) {
    console.error("[SkinReport] Error generating report card:", error);
    return new Response("Internal error", { status: 500 });
  }
}
