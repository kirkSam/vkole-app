import { useEffect, useState } from "react";
import { DAY_LIMIT_SECONDS, formatClock, VKOLE_RULES } from "@/lib/day-clock-math";

export type ClockFace = {
  childName: string;
  remainingSeconds: number;
  closed: boolean;
  armed: boolean;
  passwordSet?: boolean;
};

function LiveTime({ seconds, ticking }: { seconds: number; ticking: boolean }) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    setLeft(seconds);
  }, [seconds]);
  useEffect(() => {
    if (!ticking) return;
    const id = window.setInterval(() => setLeft((current) => Math.max(0, current - 1)), 1000);
    return () => window.clearInterval(id);
  }, [ticking, seconds]);
  return <span className="font-mono text-4xl text-ink">{formatClock(left)}</span>;
}

export function VkoleRules({ clocks, child = false }: { clocks: ClockFace[]; child?: boolean }) {
  const shown = clocks.length > 0 ? clocks : [{ childName: "Each student", remainingSeconds: DAY_LIMIT_SECONDS, closed: false, armed: false }];
  const rules = child ? VKOLE_RULES.split("\n\n").slice(1).join("\n\n") : VKOLE_RULES;
  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <p className="text-sm font-semibold tracking-wide text-accent uppercase">Time left today</p>
      <ul className="mt-2 space-y-2">
        {shown.map((clock) => (
          <li key={clock.childName} className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-base text-ink">{clock.childName}</span>
            <LiveTime seconds={clock.remainingSeconds} ticking={clock.armed && !clock.closed} />
          </li>
        ))}
      </ul>
      {shown.some((clock) => clock.closed) ? (
        <p className="mt-2 text-sm text-ink">Closed until midnight Pacific time.</p>
      ) : null}
      <p className="mt-3 text-sm leading-relaxed whitespace-pre-wrap text-ink">{rules}</p>
    </section>
  );
}
