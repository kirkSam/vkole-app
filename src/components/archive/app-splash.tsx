import "./app-splash.css";

/** Archived app splash. Not shown. The live splash matches the website. */
export function ArchivedAppSplash({ onEnter }: { onEnter: () => void }) {
  return (
    <div className="archive-splash-page">
      <main className="archive-splash">
        <h1 className="sr-only">VKOLE/ZPD - Space x.AI Supported Learning Engine</h1>
        <div className="archive-splash-stage">
          <img className="archive-splash-art archive-splash-art-wide" src="/archive/splash-wide.jpg" alt="" width={1792} height={1008} />
          <img className="archive-splash-art archive-splash-art-phone" src="/archive/splash-tall.jpg" alt="" width={1008} height={1792} />
          <button type="button" className="archive-splash-enter" onClick={onEnter}>
            <span className="archive-splash-enter-label">
              <span className="archive-splash-enter-welcome">WELCOME</span>
              <span className="archive-splash-enter-offer">Four Common Core climbs. Seven days free. Reports by email.</span>
            </span>
          </button>
        </div>
      </main>
      <footer className="archive-splash-foot">
        <blockquote>
          <p className="font-display text-xl leading-snug">
            “What is in the zone of proximal development today will be the actual developmental level tomorrow.”
          </p>
          <footer className="mt-2 text-sm text-[#cfc6b8]">Lev Vygotsky, Mind in Society, 1978</footer>
        </blockquote>
        <p className="mt-6 font-display text-lg">VKOLE/ZPD - Space x.AI Supported Learning Engine</p>
        <p className="mt-1 max-w-xl text-sm leading-relaxed text-[#cfc6b8]">
          Four climbs for a parent. Mathematics, English language arts, history and social studies, and general study. The same first name returns to the saved Common Core level.
        </p>
      </footer>
    </div>
  );
}
