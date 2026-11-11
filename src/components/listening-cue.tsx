import { Mic } from "lucide-react";

/** Same words on the app and the website. One ellipsis character. */
export const LISTENING_CUE = "Listening\u2026";

export function ListeningCue({ on }: { on: boolean }) {
  if (!on) return null;
  return (
    <p className="listening-cue" role="status" aria-live="polite">
      <Mic className="listening-mic" size={28} color="#2c5e4a" aria-hidden="true" />
      <span className="listening-word">{LISTENING_CUE}</span>
    </p>
  );
}
