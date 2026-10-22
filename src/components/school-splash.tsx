import { useCallback, useEffect, useRef } from "react";
import { SPLASH_ADVANCE_MS, claimSplashAdvance } from "@/lib/pre-account";

export function SchoolSplash({ onEnter }: { onEnter: () => void }) {
  const onEnterRef = useRef(onEnter);
  const enteredRef = useRef(false);
  const enterRef = useRef<HTMLButtonElement>(null);
  onEnterRef.current = onEnter;

  const go = useCallback(() => {
    if (!claimSplashAdvance(enteredRef.current)) return;
    enteredRef.current = true;
    onEnterRef.current();
  }, []);

  useEffect(() => {
    const id = window.setTimeout(go, SPLASH_ADVANCE_MS);
    return () => window.clearTimeout(id);
  }, [go]);

  useEffect(() => {
    enterRef.current?.focus();
  }, []);

  useEffect(() => {
    const onPointer = () => go();
    window.addEventListener("pointerdown", onPointer);
    return () => window.removeEventListener("pointerdown", onPointer);
  }, [go]);

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
      go();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  return (
    <main className="logo-splash">
      <h1 className="sr-only">ADOL with VKOLE/ZPD - Space XSI Integrated Learning Engine</h1>
      <button ref={enterRef} type="button" className="logo-splash-enter" onClick={go}>
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
      <button type="button" className="logo-splash-login" aria-label="Click anywhere" onClick={go}>
        Click anywhere
      </button>
    </main>
  );
}
