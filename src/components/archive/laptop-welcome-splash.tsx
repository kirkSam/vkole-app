import { useEffect, useRef } from "react";
import "./laptop-welcome-splash.css";

/**
 * Previous opening splash: laptop and portrait welcome art, a WELCOME overlay,
 * Log in, and a 20 second auto-advance. Not shown. Swap this back in for
 * SchoolSplash to restore it.
 */
export function ArchivedLaptopWelcomeSplash({
  onEnter,
  onLogin,
}: {
  onEnter: () => void;
  onLogin?: () => void;
}) {
  const onEnterRef = useRef(onEnter);
  onEnterRef.current = onEnter;
  useEffect(() => {
    const id = window.setTimeout(() => onEnterRef.current(), 20000);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <main className="splash">
      <h1 className="sr-only">Do the Impossible Alpha Academy</h1>
      <div className="splash-stage">
        <img
          className="splash-art splash-art-wide"
          src="/splash-laptop.jpg?v=2"
          alt=""
          width={1792}
          height={1008}
        />
        <img
          className="splash-art splash-art-phone"
          src="/splash-portrait.jpg?v=8"
          alt=""
          width={1008}
          height={1792}
        />
        <button
          type="button"
          className="splash-enter"
          aria-label="WELCOME Adaptive Diagnostic Online Learning with VKOLE/ZPD - Space x.AI Supported Learning Engine."
          onClick={onEnter}
        >
          <span className="splash-enter-label">
            <span className="splash-enter-welcome">WELCOME</span>
            <span className="splash-enter-offer">
              Adaptive Diagnostic Online Learning with VKOLE/ZPD - Space x.AI Supported Learning
              Engine.
            </span>
          </span>
        </button>
        {onLogin ? (
          <button
            type="button"
            className="splash-login"
            onClick={(event) => {
              event.stopPropagation();
              onLogin();
            }}
          >
            Log in
          </button>
        ) : null}
      </div>
    </main>
  );
}
