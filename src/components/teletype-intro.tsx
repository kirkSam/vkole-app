import { useEffect, useRef, useState } from "react";
import { APP_NAME } from "@/lib/brand";
import { beginSharedTrial } from "@/lib/climbs";
import { SCHOOL_ENGINE_URL } from "@/lib/school-account";

const LEAD =
  "What if you and your child could access a \"State of the Art\" learning engine, VKOLE/ZPD - the Space XSI Integrated Learning Engine? It is developed in conjunction with Space XSI and a team of educators dedicated to bringing applied Superintelligence to parents at an affordable cost. Additionally, what if your educational agent stored your child's levels, and gave you control of your child's levels to send you a private email report of your child's progress and achievements?";
const CAN = "YOU CAN.";
const PRICE = "FREE for a week, $79.00 USD + tax per YEAR or $9.00 USD + tax per month.";
const SPOKEN = `${LEAD} ${CAN} ${PRICE}`;

type Phase = "lead" | "can" | "price" | "done";

export function TeletypeIntro({
  onSplash,
  onContinue,
}: {
  onSplash: () => void;
  onContinue: () => void;
}) {
  const [lead, setLead] = useState("");
  const [can, setCan] = useState("");
  const [price, setPrice] = useState("");
  const [phase, setPhase] = useState<Phase>("lead");
  const caretRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const caret = caretRef.current;
    if (!caret) return;
    const actions = document.querySelector(".teletype-actions");
    const reserve = (actions instanceof HTMLElement ? actions.offsetHeight : 64) + 28;
    const hidden = caret.getBoundingClientRect().bottom - (window.innerHeight - reserve);
    if (hidden > 0) window.scrollBy({ top: hidden, behavior: "auto" });
  }, [lead, can, price, phase]);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setLead(LEAD);
      setCan(CAN);
      setPrice(PRICE);
      setPhase("done");
      return;
    }
    let cancelled = false;
    let timer = 0;
    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        timer = window.setTimeout(resolve, ms);
      });
    const type = async (text: string, write: (value: string) => void, next: Phase) => {
      setPhase(next);
      for (let i = 1; i <= text.length; i += 1) {
        if (cancelled) return;
        write(text.slice(0, i));
        await wait(39);
      }
    };
    void (async () => {
      await type(LEAD, setLead, "lead");
      if (cancelled) return;
      await type(CAN, setCan, "can");
      if (cancelled) return;
      await type(PRICE, setPrice, "price");
      if (!cancelled) setPhase("done");
    })();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  const caret = (
    <span
      ref={caretRef}
      className={`ml-0.5 inline-block h-[1em] w-2 translate-y-0.5 align-middle ${phase === "lead" ? "bg-[#e6c65c]" : "bg-current"}`}
    />
  );

  return (
    <main className="flex min-h-svh flex-col bg-[#05070d] px-6 py-10 text-[#f4f1ea]">
      <button
        type="button"
        onClick={onSplash}
        className="vkole-nav text-left font-display text-sm leading-tight tracking-wide text-[#e6c65c]"
      >
        {APP_NAME}
      </button>
      <p className="mt-8 max-w-2xl font-mono text-xl leading-relaxed" aria-label={SPOKEN}>
        {lead}
        {phase === "lead" ? caret : null}
      </p>
      {phase !== "lead" ? (
        <div className="mt-6 max-w-2xl rounded-2xl bg-[#fffdf8] px-5 py-4">
          <p
            className="font-display tracking-[0.04em] text-[#163528]"
            style={{ fontSize: "clamp(1.7rem, 4.2vw, 2.4rem)", fontWeight: 650, lineHeight: 1.15 }}
          >
            {can}
            {phase === "can" ? caret : null}
          </p>
          {price ? (
            <p
              className="mt-3 font-display text-[#101412]"
              style={{
                fontSize: "clamp(1.12rem, 2.5vw, 1.42rem)",
                fontWeight: 650,
                lineHeight: 1.3,
              }}
            >
              {price}
              {phase === "price" ? caret : null}
            </p>
          ) : null}
        </div>
      ) : null}
      <div className="teletype-actions mt-auto w-full max-w-md pt-10">
        <button
          type="button"
          className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#e6c65c] px-4 text-center text-base font-semibold text-[#1c1408]"
          onClick={() => {
            void beginSharedTrial()
              .catch(() => {
                sessionStorage.setItem("vkole-sync-trial", "1");
              })
              .finally(() => onContinue());
          }}
        >
          One week FREE
        </button>
        <p className="mt-2 text-center text-sm text-[#cfc6b8]">
          No credit card. Email registration only.
        </p>
        <a
          className="mt-3 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#e6c65c] px-4 py-2 text-center text-base font-semibold leading-tight text-[#1c1408]"
          href={SCHOOL_ENGINE_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          $79.00 USD + tax a year for this student · Stripe Secure Pay
        </a>
        <a
          className="mt-3 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#e6c65c] px-4 py-2 text-center text-base font-semibold leading-tight text-[#1c1408]"
          href={SCHOOL_ENGINE_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          $9.00 USD + tax a month for this student · Stripe Secure Pay
        </a>
        <p className="mt-3 text-sm text-[#cfc6b8]">Pay on the school website. This app does not charge the card.</p>
        <div className="mt-4 flex items-center justify-between">
          <button
            type="button"
            onClick={onContinue}
            className="inline-flex min-h-11 min-w-11 items-center justify-center px-3 text-sm text-[#e6c65c]"
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={onContinue}
            className="inline-flex min-h-11 min-w-11 items-center justify-center px-3 text-sm text-[#e6c65c]"
          >
            Skip
          </button>
        </div>
      </div>
    </main>
  );
}
