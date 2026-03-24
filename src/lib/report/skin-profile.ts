import { ImageResponse } from "next/og";
import {
  type ScanResults,
  B,
  scoreColor,
  scoreGradient,
  deriveMetrics,
  emojiBar,
} from "./skin-report";

// ------------------------------------------------
// src/lib/report/skin-profile.ts
//
// Skin Profile Card — variant of the Report Card
// used during onboarding. Differences:
//   - Title: "[Name]'s Skin Profile" (personalized)
//   - Verdict: Personality label (fun, identity-driven)
//   - CTA: "Get yours → meetSakhi.com ✨"
//   - Everything else: same layout and palette
// ------------------------------------------------

interface PersonalityLabel {
  text: string;
  emoji: string;
}

/** Score → personalized headline + emoji (same logic as report card) */
function getHeadline(s: number): { text: string; highlight: string; emoji: string } {
  if (s >= 9) return { text: "You're literally", highlight: "glowing!", emoji: "🔥" };
  if (s >= 7) return { text: "Bestie, your skin is", highlight: "thriving!", emoji: "💅" };
  if (s >= 5) return { text: "Your glow up is", highlight: "in progress!", emoji: "🌱" };
  return { text: "Your glow journey", highlight: "starts now!", emoji: "🚀" };
}

/**
 * Builds a Skin Profile Card image (1080×1350) for the onboarding flow.
 * Reuses the same Sakhiyaan palette and layout as the Report Card,
 * with personalized title, personality label, and updated CTA.
 */
export function buildProfileCardResponse(
  results: ScanResults,
  name: string,
  personalityLabel: PersonalityLabel,
  createdAt: Date,
): ImageResponse {
  const m = deriveMetrics(results);
  const headline = getHeadline(results.overall_score);

  const metrics = [
    { label: "Hydration", emoji: "💧", score: m.hydration },
    { label: "Glow Factor", emoji: "✨", score: m.glow },
    { label: "Clarity", emoji: "🫧", score: m.acneControl },
    { label: "Texture", emoji: "🪷", score: m.texture },
  ];

  const jsx = {
    type: "div",
    props: {
      style: {
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        background: `linear-gradient(180deg, ${B.bg} 0%, #FFF2EC 100%)`,
        padding: "48px 52px 40px",
        fontFamily: "Inter, system-ui, sans-serif",
        position: "relative",
      },
      children: [
        // Decorative blush orb — top right
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              position: "absolute",
              top: -150,
              right: -80,
              width: 600,
              height: 600,
              borderRadius: 300,
              background: "radial-gradient(circle, rgba(174,47,52,0.08) 0%, transparent 70%)",
            },
          },
        },
        // Decorative teal orb — bottom left
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              position: "absolute",
              bottom: -120,
              left: -80,
              width: 550,
              height: 550,
              borderRadius: 275,
              background: "radial-gradient(circle, rgba(0,106,101,0.06) 0%, transparent 70%)",
            },
          },
        },
        // Header
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 28,
            },
            children: [
              {
                type: "div",
                props: {
                  style: { display: "flex", alignItems: "center", gap: 18 },
                  children: [
                    {
                      type: "div",
                      props: {
                        style: {
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
                        },
                        children: "N",
                      },
                    },
                    {
                      type: "div",
                      props: {
                        style: { display: "flex", flexDirection: "column", gap: 2 },
                        children: [
                          {
                            type: "span",
                            props: {
                              style: {
                                fontSize: 40,
                                fontWeight: 800,
                                color: B.brown,
                                letterSpacing: "-0.02em",
                              },
                              children: `${name}'s Skin Profile`,
                            },
                          },
                          {
                            type: "span",
                            props: {
                              style: { fontSize: 22, color: B.brownLight, fontWeight: 500 },
                              children: "by Noor · your skin bestie",
                            },
                          },
                        ],
                      },
                    },
                  ],
                },
              },
              {
                type: "span",
                props: {
                  style: { fontSize: 24, color: B.brownLight, fontWeight: 500 },
                  children: createdAt.toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  }),
                },
              },
            ],
          },
        },
        // Personalized headline
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              marginBottom: 20,
              gap: 10,
            },
            children: [
              {
                type: "span",
                props: {
                  style: { fontSize: 30, fontWeight: 700, color: B.brownMid },
                  children: headline.text,
                },
              },
              {
                type: "span",
                props: {
                  style: {
                    fontSize: 30,
                    fontWeight: 800,
                    color: scoreColor(results.overall_score),
                  },
                  children: headline.highlight,
                },
              },
              {
                type: "span",
                props: { style: { fontSize: 30 }, children: headline.emoji },
              },
            ],
          },
        },
        // Score circle
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              marginBottom: 8,
              position: "relative",
            },
            children: [
              // Sparkles
              { type: "span", props: { style: { display: "flex", position: "absolute", top: 10, left: 340, fontSize: 32 }, children: "✨" } },
              { type: "span", props: { style: { display: "flex", position: "absolute", top: 60, right: 340, fontSize: 24 }, children: "✨" } },
              { type: "span", props: { style: { display: "flex", position: "absolute", bottom: 60, left: 360, fontSize: 20 }, children: "💫" } },
              // Ring
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 260,
                    height: 260,
                    borderRadius: 130,
                    background: scoreGradient(results.overall_score),
                    padding: 9,
                  },
                  children: {
                    type: "div",
                    props: {
                      style: {
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 242,
                        height: 242,
                        borderRadius: 121,
                        backgroundColor: B.bg,
                      },
                      children: {
                        type: "div",
                        props: {
                          style: { display: "flex", alignItems: "baseline" },
                          children: [
                            {
                              type: "span",
                              props: {
                                style: {
                                  fontSize: 120,
                                  fontWeight: 800,
                                  color: scoreColor(results.overall_score),
                                  lineHeight: 1,
                                  letterSpacing: "-0.05em",
                                },
                                children: String(results.overall_score),
                              },
                            },
                            {
                              type: "span",
                              props: {
                                style: { fontSize: 38, fontWeight: 500, color: B.brownLight },
                                children: "/10",
                              },
                            },
                          ],
                        },
                      },
                    },
                  },
                },
              },
              // Verdict badge — personality label
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginTop: -20,
                    background: scoreGradient(results.overall_score),
                    borderRadius: 50,
                    padding: "10px 28px",
                    gap: 8,
                  },
                  children: {
                    type: "span",
                    props: {
                      style: { fontSize: 22, fontWeight: 800, color: "#FFFFFF" },
                      children: `${personalityLabel.emoji} ${personalityLabel.text}`,
                    },
                  },
                },
              },
            ],
          },
        },
        // Metrics
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              flexDirection: "column",
              gap: 12,
              marginTop: 20,
              marginBottom: 18,
            },
            children: metrics.map((met) => ({
              type: "div",
              props: {
                style: {
                  display: "flex",
                  alignItems: "center",
                  backgroundColor: B.cardBg,
                  border: `2px solid ${B.cardBorder}`,
                  borderRadius: 28,
                  padding: "24px 32px",
                },
                children: [
                  {
                    type: "span",
                    props: {
                      style: {
                        fontSize: 36,
                        color: scoreColor(met.score),
                        fontWeight: 800,
                        width: 220,
                        letterSpacing: "-0.02em",
                      },
                      children: met.label,
                    },
                  },
                  {
                    type: "span",
                    props: {
                      style: {
                        display: "flex",
                        flex: 1,
                        fontSize: 44,
                        letterSpacing: 7,
                        justifyContent: "flex-start",
                      },
                      children: emojiBar(met.score, met.emoji),
                    },
                  },
                  {
                    type: "span",
                    props: {
                      style: {
                        fontSize: 42,
                        fontWeight: 800,
                        color: scoreColor(met.score),
                        width: 64,
                        textAlign: "right",
                      },
                      children: String(met.score),
                    },
                  },
                ],
              },
            })),
          },
        },
        // Concerns + Wins
        {
          type: "div",
          props: {
            style: { display: "flex", gap: 16, marginBottom: 10 },
            children: [
              results.key_concerns.length > 0
                ? {
                    type: "div",
                    props: {
                      style: {
                        display: "flex",
                        flexDirection: "column",
                        flex: 1,
                        backgroundColor: B.redSoft,
                        border: "2px solid #FADCDC",
                        borderRadius: 24,
                        padding: "22px 26px",
                        gap: 10,
                      },
                      children: [
                        {
                          type: "span",
                          props: {
                            style: {
                              fontSize: 20,
                              fontWeight: 800,
                              color: B.coral,
                              letterSpacing: 1.5,
                              textTransform: "uppercase",
                            },
                            children: "🎯 Focus Areas",
                          },
                        },
                        ...results.key_concerns.slice(0, 2).map((c) => ({
                          type: "span",
                          props: {
                            style: { fontSize: 22, color: B.redText, lineHeight: 1.4, fontWeight: 500 },
                            children: `• ${c}`,
                          },
                        })),
                      ],
                    },
                  }
                : null,
              results.positives.length > 0
                ? {
                    type: "div",
                    props: {
                      style: {
                        display: "flex",
                        flexDirection: "column",
                        flex: 1,
                        backgroundColor: B.greenSoft,
                        border: "2px solid #C8E6E3",
                        borderRadius: 24,
                        padding: "22px 26px",
                        gap: 10,
                      },
                      children: [
                        {
                          type: "span",
                          props: {
                            style: {
                              fontSize: 20,
                              fontWeight: 800,
                              color: B.teal,
                              letterSpacing: 1.5,
                              textTransform: "uppercase",
                            },
                            children: "💪 Your Wins",
                          },
                        },
                        ...results.positives.slice(0, 2).map((p) => ({
                          type: "span",
                          props: {
                            style: { fontSize: 22, color: B.teal, lineHeight: 1.4, fontWeight: 500 },
                            children: `• ${p}`,
                          },
                        })),
                      ],
                    },
                  }
                : null,
            ].filter(Boolean),
          },
        },
        // CTA Footer — updated for profile card
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              marginTop: "auto",
              paddingTop: 6,
              gap: 0,
            },
            children: {
              type: "div",
              props: {
                style: {
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "linear-gradient(135deg, #AE2F34, #FF6B6B)",
                  borderRadius: 60,
                  padding: "22px 56px",
                },
                children: {
                  type: "span",
                  props: {
                    style: { fontSize: 28, fontWeight: 700, color: "#FFFFFF" },
                    children: "Get yours → meetSakhi.com ✨",
                  },
                },
              },
            },
          },
        },
      ],
    },
  };

  return new ImageResponse(jsx as React.ReactElement, {
    width: 1080,
    height: 1350,
  });
}
