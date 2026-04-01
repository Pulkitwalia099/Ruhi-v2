import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

export const metadata = {
  title: "Sakhiyaan — Noor's Space",
  manifest: "/manifest.json",
  themeColor: "#1A1815",
};

export default async function PWALayout({ children }: { children: ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div
      className="min-h-dvh font-[family-name:var(--font-dm-sans)]"
      style={{ backgroundColor: "#1A1815", color: "#FAFAF9" }}
    >
      {children}
    </div>
  );
}
