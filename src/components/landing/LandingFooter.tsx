import { EntryButtons } from "./Hero";

export function LandingFooter() {
  return (
    <>
      <section aria-labelledby="closing-title" className="mx-auto max-w-[1280px] px-5 py-20 md:px-16 md:py-28">
        <h2 id="closing-title" className="font-serif text-[28px] font-bold text-ink [text-wrap:balance] md:text-[40px]">下一條線，可能就是你的。</h2>
        <EntryButtons className="mt-8 max-w-md" />
      </section>
    </>
  );
}
