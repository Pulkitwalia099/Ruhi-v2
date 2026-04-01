import Link from "next/link";

export function HomeHeader({ userName }: { userName?: string }) {
  const initial = userName?.charAt(0).toUpperCase() ?? "U";

  return (
    <header
      className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 backdrop-blur-sm"
      style={{ backgroundColor: "rgba(26, 24, 21, 0.85)" }}
    >
      <h1
        className="text-xl font-medium italic"
        style={{
          fontFamily: "var(--font-fraunces, serif)",
          color: "#FAFAF9",
        }}
      >
        Sakhiyaan
      </h1>
      <Link
        href="/profile"
        className="flex items-center justify-center w-9 h-9 rounded-full text-sm font-medium transition-colors"
        style={{ backgroundColor: "#302D2A", color: "#D6D3D1" }}
      >
        {initial}
      </Link>
    </header>
  );
}
