import { T } from "@/components/i18n/T";
import { EntryButtons } from "./Hero";

export function LandingFooter() {
  return (
    <>
      <section aria-labelledby="closing-title" className="mx-auto max-w-[1280px] px-5 py-[72px] text-center md:px-16 md:py-28">
        <h2 id="closing-title" className="mx-auto max-w-[820px] font-serif text-[clamp(30px,4.4vw,52px)] font-extrabold leading-tight text-ink [text-wrap:balance]"><T zh="下一條線，可能就是你的。" en="The next thread could be yours." /></h2>
        <EntryButtons className="mx-auto mt-10 max-w-md justify-center" />
      </section>
    </>
  );
}
