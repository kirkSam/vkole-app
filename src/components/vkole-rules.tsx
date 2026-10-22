import { VKOLE_RULES } from "@/lib/day-clock-math";

export type ClockFace = {
  childName: string;
  remainingSeconds: number;
  closed: boolean;
  armed: boolean;
  passwordSet?: boolean;
};

export function VkoleRules({ child = false }: { clocks?: ClockFace[]; child?: boolean }) {
  void child;
  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <p className="text-sm leading-relaxed whitespace-pre-wrap text-ink">{VKOLE_RULES}</p>
    </section>
  );
}
