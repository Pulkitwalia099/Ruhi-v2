"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface NotifyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companionName: string;
}

export function NotifyModal({ open, onOpenChange, companionName }: NotifyModalProps) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, companion: companionName }),
      });
      if (!res.ok) throw new Error();
      setStatus("success");
    } catch {
      setStatus("error");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl border-0 sm:max-w-md" style={{ backgroundColor: "#FFF8F5" }}>
        <DialogHeader>
          <DialogTitle
            className="font-[var(--font-heading)] text-xl font-bold"
            style={{ color: "#2D1810" }}
          >
            Get notified when {companionName} launches
          </DialogTitle>
          <DialogDescription style={{ color: "#584140" }}>
            We&apos;ll send you one email. No spam, promise.
          </DialogDescription>
        </DialogHeader>

        {status === "success" ? (
          <div className="py-6 text-center">
            <p className="text-lg font-medium" style={{ color: "#2D1810" }}>
              You&apos;re on the list! We&apos;ll let you know. 💛
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-2">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="rounded-full px-5 py-3 text-sm outline-none"
              style={{ backgroundColor: "#F9F2EF", color: "#2D1810" }}
            />
            <button
              type="submit"
              disabled={status === "loading"}
              className="rounded-full px-6 py-3 text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, #AE2F34, #FF6B6B)" }}
            >
              {status === "loading" ? "Saving..." : "Notify Me"}
            </button>
            {status === "error" && (
              <p className="text-center text-sm" style={{ color: "#BA1A1A" }}>
                Something went wrong. Try again?
              </p>
            )}
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
