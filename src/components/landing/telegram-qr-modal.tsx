"use client";

import { QRCodeSVG } from "qrcode.react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const TELEGRAM_URL = process.env.NEXT_PUBLIC_TELEGRAM_BOT_URL!;

interface TelegramQrModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TelegramQrModal({ open, onOpenChange }: TelegramQrModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl border-0 sm:max-w-sm" style={{ backgroundColor: "#FFF8F5" }}>
        <DialogHeader>
          <DialogTitle
            className="font-[var(--font-heading)] text-xl font-bold"
            style={{ color: "#2D1810" }}
          >
            Scan to chat with Noor
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-4">
          <div className="rounded-2xl bg-white p-4">
            <QRCodeSVG
              value={TELEGRAM_URL}
              size={200}
              fgColor="#2D1810"
              bgColor="#FFFFFF"
            />
          </div>
          <a
            href={TELEGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium underline"
            style={{ color: "#006A65" }}
          >
            Or open Telegram →
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
}
