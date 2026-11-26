import type { Metadata } from "next";
import { ForBoth } from "@/components/landing/ForBoth";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { TopBar } from "@/components/landing/TopBar";
import { Trust } from "@/components/landing/Trust";
import { ThreadCanvas } from "@/components/thread/ThreadCanvas";
import { SkipLink } from "@/components/ui/SkipLink";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";

export const metadata: Metadata = { title: { absolute: `${SITE_NAME}｜${SITE_TAGLINE}` } };

export default function Home() {
  return (
    <>
      <SkipLink />
      <TopBar />
      <main id="main" tabIndex={-1} className="outline-none">
        <Hero scene={<ThreadCanvas variant="hero" />} />
        <HowItWorks />
        <ForBoth />
        <Trust />
      </main>
      <LandingFooter />
    </>
  );
}
