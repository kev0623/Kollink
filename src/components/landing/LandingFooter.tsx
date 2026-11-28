import { T } from "@/components/i18n/T";
import { EntryButtons } from "./Hero";

export function LandingFooter() {
  return (
    <>
      <section aria-labelledby="closing-title" className="reveal mx-auto max-w-[1280px] px-5 py-20 text-center md:px-16 md:py-32">
        <h2 id="closing-title" className="mx-auto max-w-[820px] font-serif text-[32px] font-bold text-ink md:text-[56px]"><T zh="下一條線，可能就是你的。" en="The next thread could be yours." /></h2>
        <EntryButtons className="mx-auto mt-10 max-w-md justify-center" />
      </section>
    </>
  );
}
