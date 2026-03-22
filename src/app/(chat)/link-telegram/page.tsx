"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export default function LinkTelegramPage() {
  const [code, setCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [isLinked, setIsLinked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/link-telegram`)
      .then((r) => r.json())
      .then((data) => {
        setIsLinked(data.linked);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!expiresAt) return;
    const interval = setInterval(() => {
      const remaining = Math.max(
        0,
        Math.floor((expiresAt.getTime() - Date.now()) / 1000)
      );
      setTimeLeft(remaining);
      if (remaining <= 0) {
        setCode(null);
        setExpiresAt(null);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const generateCode = async () => {
    setGenerating(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/link-telegram`,
        { method: "POST" }
      );
      const data = await res.json();
      if (res.ok) {
        setCode(data.code);
        setExpiresAt(new Date(data.expiresAt));
      }
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-dvh items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (isLinked) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-4 px-4">
        <h1 className="text-2xl font-semibold">Telegram Linked</h1>
        <p className="text-center text-muted-foreground">
          Your Telegram account is already connected. Memories, scans, and chat
          history are unified across both platforms.
        </p>
        <Button
          onClick={() =>
            (window.location.href = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/`)
          }
          variant="outline"
        >
          Back to Chat
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-6 px-4">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">Link your Telegram</h1>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          Connect your Telegram account so Ruhi remembers everything across both
          web and Telegram.
        </p>
      </div>

      {code ? (
        <div className="flex flex-col items-center gap-4">
          <div className="rounded-xl border border-border bg-card px-8 py-4">
            <p className="font-mono text-3xl font-bold tracking-[0.3em]">
              {code}
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            Send{" "}
            <code className="rounded bg-muted px-1.5 py-0.5">
              /link {code}
            </code>{" "}
            to Ruhi on Telegram
          </p>
          <p className="text-xs text-muted-foreground/60">
            Expires in {Math.floor(timeLeft / 60)}:
            {String(timeLeft % 60).padStart(2, "0")}
          </p>
        </div>
      ) : (
        <Button disabled={generating} onClick={generateCode}>
          {generating ? "Generating..." : "Generate Link Code"}
        </Button>
      )}

      <Button
        className="mt-4"
        onClick={() =>
          (window.location.href = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/`)
        }
        variant="ghost"
      >
        Back to Chat
      </Button>
    </div>
  );
}
