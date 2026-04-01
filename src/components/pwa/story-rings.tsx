"use client";

import { useState } from "react";
import type { Cycle, Scan, Streak } from "@/db/schema";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface StoryRingsProps {
  scans: Scan[];
  streak: Streak | null;
  cycle: Cycle | null;
}

type RingType = "score" | "streak" | "cycle" | "scan";

function getCyclePhase(cycle: Cycle): { phase: string; day: number } {
  const now = new Date();
  const start = new Date(cycle.periodStart);
  const diffMs = now.getTime() - start.getTime();
  const dayInCycle = Math.floor(diffMs / (1000 * 60 * 60 * 24)) % cycle.cycleLength;

  if (dayInCycle <= 5) return { phase: "Menstrual", day: dayInCycle };
  if (dayInCycle <= 13) return { phase: "Follicular", day: dayInCycle };
  if (dayInCycle <= 16) return { phase: "Ovulatory", day: dayInCycle };
  return { phase: "Luteal", day: dayInCycle };
}

function Ring({
  label,
  value,
  borderColor,
  hasNew,
  onClick,
}: {
  label: string;
  value: string;
  borderColor: string;
  hasNew: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 flex-shrink-0"
    >
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center text-sm font-semibold transition-transform active:scale-95"
        style={{
          border: `3px solid ${hasNew ? borderColor : "rgba(250, 250, 249, 0.08)"}`,
          backgroundColor: "#252220",
          color: "#FAFAF9",
          fontFamily: "var(--font-geist, sans-serif)",
        }}
      >
        {value}
      </div>
      <span
        className="text-[11px]"
        style={{ color: "#A8A29E" }}
      >
        {label}
      </span>
    </button>
  );
}

export function StoryRings({ scans, streak, cycle }: StoryRingsProps) {
  const [activeSheet, setActiveSheet] = useState<RingType | null>(null);

  const latestScan = scans[0];
  const scanScore = latestScan
    ? (latestScan.results as Record<string, unknown>)?.overallScore
    : null;

  const cycleInfo = cycle ? getCyclePhase(cycle) : null;

  return (
    <>
      <div className="flex gap-4 overflow-x-auto py-4 px-1 scrollbar-hide">
        {/* Skin Score */}
        <Ring
          label="Skin Score"
          value={typeof scanScore === "number" ? `${scanScore}` : "—"}
          borderColor="#E8655A"
          hasNew={scans.length > 0}
          onClick={() => setActiveSheet("score")}
        />

        {/* Streak */}
        <Ring
          label="Streak"
          value={streak ? `${streak.currentStreak}` : "0"}
          borderColor="#E8655A"
          hasNew={!!streak && streak.currentStreak > 0}
          onClick={() => setActiveSheet("streak")}
        />

        {/* Cycle */}
        <Ring
          label="Cycle"
          value={cycleInfo?.phase?.slice(0, 3) ?? "—"}
          borderColor="#3DB9A8"
          hasNew={!!cycle}
          onClick={() => setActiveSheet("cycle")}
        />

        {/* + Scan */}
        <Ring
          label="+ Scan"
          value="+"
          borderColor="transparent"
          hasNew={false}
          onClick={() => {
            window.location.href = "/chat/new?prompt=Scan%20my%20face";
          }}
        />
      </div>

      {/* Skin Score Sheet */}
      <Sheet open={activeSheet === "score"} onOpenChange={(open) => !open && setActiveSheet(null)}>
        <SheetContent side="bottom" className="rounded-t-2xl" style={{ backgroundColor: "#1A1815", borderColor: "rgba(250, 250, 249, 0.08)" }}>
          <SheetHeader>
            <SheetTitle style={{ color: "#FAFAF9", fontFamily: "var(--font-fraunces, serif)" }}>
              Skin Score
            </SheetTitle>
          </SheetHeader>
          <div className="py-4 space-y-4">
            {typeof scanScore === "number" ? (
              <>
                <div className="text-center">
                  <span
                    className="text-4xl font-bold"
                    style={{ color: "#E8655A", fontFamily: "var(--font-geist, sans-serif)" }}
                  >
                    {scanScore}
                  </span>
                  <span className="text-lg" style={{ color: "#A8A29E" }}> / 10</span>
                </div>
                {scans.length >= 2 && (
                  <p className="text-center text-sm" style={{ color: "#D6D3D1" }}>
                    {(() => {
                      const prevScore = (scans[1].results as Record<string, unknown>)?.overallScore;
                      if (typeof prevScore !== "number") return null;
                      const diff = scanScore - prevScore;
                      if (diff > 0) return `↑ +${diff.toFixed(1)} from last scan`;
                      if (diff < 0) return `↓ ${diff.toFixed(1)} from last scan`;
                      return "Same as last scan";
                    })()}
                  </p>
                )}
                <p className="text-sm" style={{ color: "#A8A29E" }}>
                  Last scan: {new Date(scans[0].createdAt).toLocaleDateString("en-IN", { month: "long", day: "numeric" })}
                </p>
              </>
            ) : (
              <p className="text-center text-sm" style={{ color: "#A8A29E" }}>
                No scans yet — tap + Scan to get started
              </p>
            )}
            <button
              type="button"
              onClick={() => { setActiveSheet(null); window.location.href = "/chat/new?prompt=My%20progress"; }}
              className="w-full text-center text-sm py-2"
              style={{ color: "#3DB9A8" }}
            >
              Ask Noor about this →
            </button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Streak Sheet */}
      <Sheet open={activeSheet === "streak"} onOpenChange={(open) => !open && setActiveSheet(null)}>
        <SheetContent side="bottom" className="rounded-t-2xl" style={{ backgroundColor: "#1A1815", borderColor: "rgba(250, 250, 249, 0.08)" }}>
          <SheetHeader>
            <SheetTitle style={{ color: "#FAFAF9", fontFamily: "var(--font-fraunces, serif)" }}>
              Your Streak
            </SheetTitle>
          </SheetHeader>
          <div className="py-4 space-y-3 text-center">
            <span
              className="text-4xl font-bold"
              style={{ color: "#E8655A", fontFamily: "var(--font-geist, sans-serif)" }}
            >
              {streak?.currentStreak ?? 0} days
            </span>
            {streak && streak.longestStreak > 0 && (
              <p className="text-sm" style={{ color: "#A8A29E" }}>
                Longest: {streak.longestStreak} days
              </p>
            )}
            <button
              type="button"
              onClick={() => { setActiveSheet(null); window.location.href = "/chat/new?prompt=Scan%20my%20face"; }}
              className="w-full text-center text-sm py-2"
              style={{ color: "#3DB9A8" }}
            >
              Keep it going — scan today →
            </button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Cycle Sheet */}
      <Sheet open={activeSheet === "cycle"} onOpenChange={(open) => !open && setActiveSheet(null)}>
        <SheetContent side="bottom" className="rounded-t-2xl" style={{ backgroundColor: "#1A1815", borderColor: "rgba(250, 250, 249, 0.08)" }}>
          <SheetHeader>
            <SheetTitle style={{ color: "#FAFAF9", fontFamily: "var(--font-fraunces, serif)" }}>
              Cycle Phase
            </SheetTitle>
          </SheetHeader>
          <div className="py-4 space-y-3">
            {cycleInfo ? (
              <>
                <p className="text-center text-lg font-medium" style={{ color: "#FAFAF9" }}>
                  {cycleInfo.phase} · Day {cycleInfo.day}
                </p>
                <div className="space-y-1.5 text-sm" style={{ color: "#D6D3D1" }}>
                  <p className="font-medium" style={{ color: "#A8A29E" }}>Skin impact:</p>
                  {cycleInfo.phase === "Menstrual" && (
                    <>
                      <p>• Skin is more sensitive</p>
                      <p>• Focus on gentle, hydrating products</p>
                      <p>• Avoid harsh exfoliants</p>
                    </>
                  )}
                  {cycleInfo.phase === "Follicular" && (
                    <>
                      <p>• Skin is at its best — glow time</p>
                      <p>• Good time for new product trials</p>
                      <p>• Active ingredients work well now</p>
                    </>
                  )}
                  {cycleInfo.phase === "Ovulatory" && (
                    <>
                      <p>• Skin is plump and hydrated</p>
                      <p>• Natural glow peaks</p>
                      <p>• Lighter products work well</p>
                    </>
                  )}
                  {cycleInfo.phase === "Luteal" && (
                    <>
                      <p>• More oil production</p>
                      <p>• Breakouts more likely</p>
                      <p>• Increase gentle cleansing</p>
                    </>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => { setActiveSheet(null); window.location.href = "/chat/new?prompt=What%20should%20I%20adjust%20for%20my%20cycle%20phase"; }}
                  className="w-full text-center text-sm py-2"
                  style={{ color: "#3DB9A8" }}
                >
                  Ask Noor what to adjust →
                </button>
              </>
            ) : (
              <p className="text-center text-sm" style={{ color: "#A8A29E" }}>
                No cycle data yet — tell Noor when your period starts
              </p>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
