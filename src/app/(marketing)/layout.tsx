import { Plus_Jakarta_Sans, Be_Vietnam_Pro } from "next/font/google";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-heading",
  weight: ["500", "600", "700", "800"],
});

const beVietnam = Be_Vietnam_Pro({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-body",
  weight: ["400", "500", "600"],
});

export const metadata = {
  title: "Sakhiyaan — Your Digital Sanctuary",
  description:
    "Meet Noor, your AI skin companion. Guided by science, rooted in empathy, designed for your holistic well-being.",
};

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={`${plusJakarta.variable} ${beVietnam.variable} min-h-screen`}
      style={{ backgroundColor: "#FFF8F5" }}
    >
      {children}
    </div>
  );
}
