import { useEffect, useRef } from "react";

/** Same delay as the school site splash (`setTimeout(..., 7000)` before `/discover`). */
const ADVANCE_MS = 7000;

export function SchoolSplash({ onEnter }: { onEnter: () => void }) {
  const onEnterRef = useRef(onEnter);
  const enterRef = useRef<HTMLButtonElement>(null);
  onEnterRef.current = onEnter;

  useEffect(() => {
    const id = window.setTimeout(() => onEnterRef.current(), ADVANCE_MS);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    enterRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Enter" && event.key !== " " && event.key !== "Spacebar") return;
      const target = event.target;
      if (
        target instanceof Element &&
        (target.closest(".logo-splash-login") ||
          target.closest(".logo-splash-enter") ||
          target.closest("a, button, input, textarea, select, [role='button']"))
      ) {
        return;
      }
      event.preventDefault();
      onEnterRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <main className="logo-splash">
      <h1 className="sr-only">ADOL with VKOLE/ZPD - Space x.AI Integrated Learning Engine</h1>
      <button ref={enterRef} type="button" className="logo-splash-enter" onClick={() => onEnter()}>
        <picture>
          <source srcSet="/logo-splash.webp" type="image/webp" />
          <img
            className="logo-splash-art"
            src="/logo-splash.png"
            alt="Do the Impossible Alpha Academy. A golden open book with a rising star on a navy night sky. Continue."
            width={1280}
            height={720}
          />
        </picture>
      </button>
      <button
        type="button"
        className="logo-splash-login"
        aria-label="Click anywhere"
        onClick={() => onEnter()}
      >
        Click anywhere
      </button>
    </main>
  );
}
