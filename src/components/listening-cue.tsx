/** Same words on the app and the website. Shown only while the microphone is open. */
export const LISTENING_CUE = "Listening…";

export function ListeningCue({ on }: { on: boolean }) {
  if (!on) return null;
  return (
    <p className="listening-cue" role="status">
      <svg className="listening-mic" viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
        <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" />
        <path d="M6 11a6 6 0 0 0 12 0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M12 17.5v2.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M8.5 21.5h7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      {LISTENING_CUE}
    </p>
  );
}
