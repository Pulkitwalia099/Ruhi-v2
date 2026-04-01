import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { getStreakCard, getUserProducts, db } from "@/db/queries";
import { user as userTable } from "@/db/schema";

export default async function ProfilePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");

  const userId = session.user.id;

  // Query full user row (session type doesn't include telegramId/instagramId)
  const [fullUser] = await db
    .select()
    .from(userTable)
    .where(eq(userTable.id, userId))
    .limit(1);

  if (!fullUser) redirect("/login");

  const [streak, products] = await Promise.all([
    getStreakCard({ userId }),
    getUserProducts({ userId }),
  ]);

  return (
    <div className="min-h-dvh font-[family-name:var(--font-dm-sans)]" style={{ backgroundColor: "#1A1815", color: "#FAFAF9" }}>
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: "1px solid rgba(250, 250, 249, 0.08)" }}>
        <Link href="/" className="text-sm" style={{ color: "#A8A29E" }}>
          ← Back
        </Link>
        <h1
          className="text-lg font-medium"
          style={{ fontFamily: "var(--font-fraunces, serif)" }}
        >
          Profile
        </h1>
      </header>

      <div className="px-4 py-6 space-y-6">
        {/* Account Info */}
        <section className="p-4 rounded-2xl" style={{ backgroundColor: "#252220", border: "1px solid rgba(250, 250, 249, 0.08)" }}>
          <h2 className="text-sm font-medium mb-3" style={{ color: "#A8A29E" }}>
            Account
          </h2>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm" style={{ color: "#D6D3D1" }}>Name</span>
              <span className="text-sm" style={{ color: "#FAFAF9" }}>{fullUser.name ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm" style={{ color: "#D6D3D1" }}>Email</span>
              <span className="text-sm" style={{ color: "#FAFAF9" }}>{fullUser.email}</span>
            </div>
          </div>
        </section>

        {/* Linked Platforms */}
        <section className="p-4 rounded-2xl" style={{ backgroundColor: "#252220", border: "1px solid rgba(250, 250, 249, 0.08)" }}>
          <h2 className="text-sm font-medium mb-3" style={{ color: "#A8A29E" }}>
            Linked Platforms
          </h2>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm" style={{ color: "#D6D3D1" }}>Telegram</span>
              <span
                className="text-xs px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor: fullUser.telegramId
                    ? "rgba(61, 185, 168, 0.12)"
                    : "rgba(250, 250, 249, 0.05)",
                  color: fullUser.telegramId ? "#3DB9A8" : "#78716C",
                }}
              >
                {fullUser.telegramId ? "Connected" : "Not linked"}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm" style={{ color: "#D6D3D1" }}>Instagram</span>
              <span
                className="text-xs px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor: fullUser.instagramId
                    ? "rgba(61, 185, 168, 0.12)"
                    : "rgba(250, 250, 249, 0.05)",
                  color: fullUser.instagramId ? "#3DB9A8" : "#78716C",
                }}
              >
                {fullUser.instagramId ? "Connected" : "Not linked"}
              </span>
            </div>
          </div>
        </section>

        {/* Streak */}
        <section className="p-4 rounded-2xl" style={{ backgroundColor: "#252220", border: "1px solid rgba(250, 250, 249, 0.08)" }}>
          <h2 className="text-sm font-medium mb-3" style={{ color: "#A8A29E" }}>
            Streak
          </h2>
          <div className="flex items-baseline gap-2">
            <span
              className="text-3xl font-bold"
              style={{ color: "#E8655A", fontFamily: "var(--font-geist, sans-serif)" }}
            >
              {streak?.currentStreak ?? 0}
            </span>
            <span className="text-sm" style={{ color: "#D6D3D1" }}>day streak</span>
          </div>
          {streak && streak.longestStreak > 0 && (
            <p className="text-xs mt-1" style={{ color: "#A8A29E" }}>
              Longest: {streak.longestStreak} days
            </p>
          )}
        </section>

        {/* Products Library */}
        <section className="p-4 rounded-2xl" style={{ backgroundColor: "#252220", border: "1px solid rgba(250, 250, 249, 0.08)" }}>
          <h2 className="text-sm font-medium mb-3" style={{ color: "#A8A29E" }}>
            Products ({products.length})
          </h2>
          {products.length === 0 ? (
            <p className="text-sm" style={{ color: "#78716C" }}>
              No products analyzed yet — ask Noor to check a product
            </p>
          ) : (
            <div className="space-y-3">
              {products.slice(0, 10).map((p) => (
                <Link
                  key={p.id}
                  href={`/chat/new?prompt=${encodeURIComponent(`Tell me more about ${p.name}`)}`}
                  className="flex items-center gap-3 py-2"
                >
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-xs"
                    style={{ backgroundColor: "#302D2A", color: "#A8A29E" }}
                  >
                    {p.imageUrl ? (
                      <img src={p.imageUrl} alt={p.name} className="w-full h-full rounded-lg object-cover" />
                    ) : (
                      "🧴"
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate" style={{ color: "#FAFAF9" }}>
                      {p.name}
                    </p>
                    <p className="text-xs" style={{ color: "#A8A29E" }}>
                      {new Date(p.scannedAt).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
