import { LandingNav } from "@/components/landing/nav";
import { Hero } from "@/components/landing/hero";
import { ChatPreview } from "@/components/landing/chat-preview";
import { Companions } from "@/components/landing/companions";
import { InterconnectedCare } from "@/components/landing/interconnected-care";
import { SocialProof } from "@/components/landing/social-proof";
import { FinalCta } from "@/components/landing/final-cta";
import { Footer } from "@/components/landing/footer";

export default function LandingPage() {
  return (
    <>
      <LandingNav />
      <main>
        <Hero />
        <ChatPreview />
        <Companions />
        <InterconnectedCare />
        <SocialProof />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}
