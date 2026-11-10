import { useEffect, useRef, useState } from "react";
import { holdEngineMic, noteEngineActivity } from "@/lib/engine-activity";
import { LISTENING_BEST, PARENT_NEEDS_VOICE, PHONE_CANNOT_HEAR } from "@/lib/voice-consent";
import { voiceAllowedNow } from "@/lib/voice-consent-api";
import {
  SPEAK_FAILED_LINE,
  createListener,
  listenFailureLine,
  listenKind,
  listenerReady,
  setCannotSpeakHook,
  speakAloud,
  stopSpeaking,
} from "@/lib/speech/listener";
import { SIGHT_WORD_ADVANCE_MS, SIGHT_WORD_MAX_SHOW_MS } from "@/lib/vkole/constants";
import { judgeSpoken, speechTokens } from "@/lib/vkole/sight-words/match";
import { entryFor } from "@/lib/vkole/sight-words/words";

const WORD_COLORS = ["#2c5e4a", "#7a2e1f", "#1d4e89", "#8a5a12", "#5c3d8f", "#0e6b6b", "#9a3d62", "#3d6b1f"];

type SpeechAlternative = { transcript?: string };
type SpeechResult = ArrayLike<SpeechAlternative> & { isFinal?: boolean };
type SpeechEvent = { resultIndex?: number; results: ArrayLike<SpeechResult> };
type SpeechListener = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechEvent) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  abort: () => void;
};

type Outcome = "correct" | "miss" | "timeout";

function speakWord(word: string, done: () => void): () => void {
  return speakAloud(word, done, { rate: 0.9, capMs: 8000 });
}
function colorFor(word: string): string {
  let n = 0;
  for (const ch of word) n = (n * 33 + ch.charCodeAt(0)) >>> 0;
  return WORD_COLORS[n % WORD_COLORS.length] ?? WORD_COLORS[0]!;
}

export function SightWordStage({
  word,
  band,
  index = 0,
  voiceAllowed = false,
  onDone,
}: {
  word: string;
  band?: string;
  index?: number;
  voiceAllowed?: boolean;
  onDone: (outcome: Outcome) => void;
}) {
  const [ready, setReady] = useState(false);
  const [unsupported, setUnsupported] = useState(false);
  const [phase, setPhase] = useState<"show" | "sparkle" | "speak">("show");
  const [listenNote, setListenNote] = useState(PHONE_CANNOT_HEAR);
  const [quiet, setQuiet] = useState(false);
  const onDoneRef = useRef(onDone);
  const finishRef = useRef<(outcome: Outcome) => void>(() => {});
  const advanceRef = useRef(0);
  onDoneRef.current = onDone;

  useEffect(() => {
    const supported = listenerReady();
    setUnsupported(!supported);
    setReady(true);
  }, []);

  useEffect(() => {
    setPhase("show");
  }, [word]);

  useEffect(() => setCannotSpeakHook(() => setQuiet(true)), []);

  useEffect(() => {
    noteEngineActivity();
  }, [phase, word]);

  const entry = entryFor(band, index, word);
  const listening = ready && !unsupported && voiceAllowed && phase === "show";

  useEffect(() => {
    if (!listening) return;
    return holdEngineMic();
  }, [listening]);

  useEffect(() => {
    if (!ready || phase !== "show" || (voiceAllowed && !listening && !unsupported)) return;
    let live = true;
    const settled = { current: false };
    let rec: SpeechListener | null = null;
    const timer = window.setTimeout(() => finishRef.current("timeout"), SIGHT_WORD_MAX_SHOW_MS);

    finishRef.current = (outcome: Outcome) => {
      if (!live || settled.current) return;
      settled.current = true;
      window.clearTimeout(timer);
      try {
        rec?.abort();
      } catch {
        /* already stopped */
      }
      rec = null;
      window.clearTimeout(advanceRef.current);
      if (outcome === "correct") {
        setPhase("sparkle");
        advanceRef.current = window.setTimeout(() => onDoneRef.current("correct"), SIGHT_WORD_ADVANCE_MS);
        return;
      }
      setPhase("speak");
      speakWord(word, () => {
        advanceRef.current = window.setTimeout(() => onDoneRef.current(outcome), SIGHT_WORD_ADVANCE_MS);
      });
    };

    if (listening) {
      void voiceAllowedNow().then((ok) => {
        if (!live || settled.current || !ok) return;
        rec = createListener();
        if (!rec) return;
        rec.lang = "en-US";
        rec.continuous = true;
        rec.interimResults = true;
        rec.onresult = (event) => {
          noteEngineActivity();
          const start = event.resultIndex ?? 0;
          for (let i = start; i < event.results.length; i += 1) {
            const result = event.results[i];
            if (!result) continue;
            for (let j = 0; j < result.length; j += 1) {
              const transcript = result[j]?.transcript ?? "";
              if (speechTokens(transcript).length === 0) continue;
              const judged = judgeSpoken(word, transcript, Boolean(result.isFinal), entry.also);
              if (judged === "wait") continue;
              finishRef.current(judged);
              return;
            }
          }
        };
        rec.onerror = (event) => {
          const kind = listenKind(event.error);
          if (!kind) return;
          setListenNote(listenFailureLine(kind));
          setUnsupported(true);
        };
        rec.onend = () => {
          noteEngineActivity();
          if (!live || settled.current || !rec) return;
          try {
            rec.start();
          } catch {
            /* start races with abort */
          }
        };
        try {
          rec.start();
        } catch {
          setUnsupported(true);
        }
      });
    }

    return () => {
      live = false;
      window.clearTimeout(timer);
      try {
        rec?.abort();
      } catch {
        /* already stopped */
      }
    };
  }, [entry.also, listening, phase, ready, unsupported, voiceAllowed, word]);

  useEffect(() => {
    return () => {
      window.clearTimeout(advanceRef.current);
      if (typeof window !== "undefined") stopSpeaking();
    };
  }, [word]);

  if (!ready) return <p className="mt-6 text-sm text-muted">Sight words</p>;

  const shown = phase !== "speak";
  const adult = !voiceAllowed || unsupported;

  return (
    <section className="mt-6" aria-live="polite">
      <p className="text-center text-xs tracking-wide text-muted uppercase">{listening ? "Listening" : "Sight word"}</p>
      <p className="mt-2 text-center text-sm text-ink">{LISTENING_BEST}</p>
      <div className={phase === "sparkle" ? "sight-sparkle relative mt-4" : "relative mt-4"}>
        {shown ? (
          <p className="sight-word font-display font-semibold" style={{ color: colorFor(word) }}>
            {Array.from(word).map((letter, at) => (
              <span key={`${letter}-${at}`} className={entry.word === word && entry.heart.includes(at) ? "sight-heart" : undefined}>
                {letter === " " ? "\u00a0" : letter}
              </span>
            ))}
          </p>
        ) : (
          <p className="sight-word font-display text-muted"> </p>
        )}
      </div>
      {quiet ? <p className="mt-4 text-center text-sm text-ink">{SPEAK_FAILED_LINE}</p> : null}
      {adult ? (
        <div className="mt-6">
          <p className="text-sm text-ink">{voiceAllowed ? listenNote : PARENT_NEEDS_VOICE}</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <button type="button" onClick={() => finishRef.current("correct")} className="min-h-11 flex-1 rounded-xl bg-accent px-5 font-semibold text-accent-ink">
              Correct
            </button>
            <button type="button" onClick={() => finishRef.current("miss")} className="min-h-11 flex-1 rounded-xl border border-ink bg-paper px-5 font-semibold text-ink">
              Miss
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-8 text-center">
          <p className="text-xs text-muted">Adult override</p>
          <div className="mt-1 flex justify-center gap-3">
            <button type="button" onClick={() => finishRef.current("correct")} className="text-xs text-muted underline">
              Correct
            </button>
            <button type="button" onClick={() => finishRef.current("miss")} className="text-xs text-muted underline">
              Miss
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
