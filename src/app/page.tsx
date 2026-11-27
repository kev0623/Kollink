import type { Metadata } from "next";
import { ForBoth } from "@/components/landing/ForBoth";
import { Hero } from "@/components/landing/Hero";
import { Faq } from "@/components/landing/Faq";
import { FeaturedCreators } from "@/components/landing/FeaturedCreators";
import { Workflow } from "@/components/landing/Workflow";
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
        <FeaturedCreators />
        <Workflow />
        <Trust />
        <ForBoth />
        <Faq />
      </main>
      <LandingFooter />
    </>
  );
}
