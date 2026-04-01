import { Suspense } from "react";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getHomescreenData } from "@/db/queries";
import { loadAndFormatMemories } from "@/lib/memory/loader";
import { StoryRings } from "@/components/pwa/story-rings";
import { NoorGreeting } from "@/components/pwa/noor-greeting";
import { SuggestionChips } from "@/components/pwa/suggestion-chips";
import { HomeInputBar } from "@/components/pwa/home-input-bar";
import { HomeHeader } from "@/components/pwa/home-header";

async function HomescreenContent() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;

  const userId = session.user.id;
  const [data, memoriesBlock] = await Promise.all([
    getHomescreenData({ userId }),
    loadAndFormatMemories(userId),
  ]);

  return (
    <>
      <HomeHeader userName={session.user.name ?? undefined} />

      <main className="flex-1 px-4 pb-24">
        <StoryRings
          scans={data.scans}
          streak={data.streak}
          cycle={data.cycle}
        />

        <NoorGreeting
          scans={data.scans}
          streak={data.streak}
          cycle={data.cycle}
          memoriesBlock={memoriesBlock}
        />

        <SuggestionChips hasScans={data.scans.length > 0} />
      </main>

      <HomeInputBar />
    </>
  );
}

export default function HomescreenPage() {
  return (
    <div className="flex flex-col min-h-dvh">
      <Suspense
        fallback={
          <div className="flex-1 flex items-center justify-center" style={{ color: "#A8A29E" }}>
            Loading...
          </div>
        }
      >
        <HomescreenContent />
      </Suspense>
    </div>
  );
}
