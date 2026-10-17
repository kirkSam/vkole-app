import { useEffect, useRef, useState } from "react";
import { SIGHT_WORD_ADVANCE_MS, SIGHT_WORD_MAX_SHOW_MS } from "@/lib/vkole/constants";
import { judgeSpoken } from "@/lib/vkole/sight-words/match";

const MIC_KEY = "vkole-sw-mic";
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

function recognitionCtor(): (new () => SpeechListener) | null {
  if (typeof window === "undefined") return null;
  const host = window as Window & {
    SpeechRecognition?: new () => SpeechListener;
    webkitSpeechRecognition?: new () => SpeechListener;
  };
  return host.SpeechRecognition ?? host.webkitSpeechRecognition ?? null;
}

function colorFor(word: string): string {
  let n = 0;
  for (const ch of word) n = (n * 33 + ch.charCodeAt(0)) >>> 0;
  return WORD_COLORS[n % WORD_COLORS.length] ?? WORD_COLORS[0]!;
}

function speakWord(word: string, done: () => void) {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    done();
    return;
  }
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    window.clearTimeout(cap);
    done();
  };
  const cap = window.setTimeout(finish, 8000);
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(word);
  utter.lang = "en-US";
  utter.rate = 0.9;
  utter.onend = finish;
  utter.onerror = finish;
  window.speechSynthesis.speak(utter);
}

export function SightWordStage({ word, onDone }: { word: string; onDone: (outcome: Outcome) => void }) {
  const [ready, setReady] = useState(false);
  const [unsupported, setUnsupported] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [phase, setPhase] = useState<"show" | "sparkle" | "speak">("show");
  const onDoneRef = useRef(onDone);
  const finishRef = useRef<(outcome: Outcome) => void>(() => {});
  const advanceRef = useRef(0);
  onDoneRef.current = onDone;

  useEffect(() => {
    const supported = recognitionCtor() != null;
    setUnsupported(!supported);
    try {
      setAllowed(window.sessionStorage.getItem(MIC_KEY) === "1");
    } catch {
      setAllowed(false);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    setPhase("show");
  }, [word]);

  const listening = ready && !unsupported && allowed && phase === "show";

  useEffect(() => {
    if (!ready || phase !== "show" || (!listening && !unsupported)) return;
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
      const Ctor = recognitionCtor();
      if (Ctor) {
        rec = new Ctor();
        rec.lang = "en-US";
        rec.continuous = true;
        rec.interimResults = true;
        rec.onresult = (event) => {
          const start = event.resultIndex ?? 0;
          for (let i = start; i < event.results.length; i += 1) {
            const result = event.results[i];
            if (!result) continue;
            for (let j = 0; j < result.length; j += 1) {
              const judged = judgeSpoken(word, result[j]?.transcript ?? "", Boolean(result.isFinal));
              if (judged === "wait") continue;
              finishRef.current(judged);
              return;
            }
          }
        };
        rec.onerror = (event) => {
          if (event.error === "not-allowed" || event.error === "service-not-allowed") setUnsupported(true);
        };
        rec.onend = () => {
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
      }
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
  }, [listening, phase, ready, unsupported, word]);

  useEffect(() => {
    return () => {
      window.clearTimeout(advanceRef.current);
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    };
  }, [word]);

  function allowMic() {
    try {
      window.sessionStorage.setItem(MIC_KEY, "1");
    } catch {
      /* storage may be unavailable */
    }
    setAllowed(true);
  }

  if (!ready) return <p className="mt-6 text-sm text-muted">Sight words</p>;

  if (!unsupported && !allowed) {
    return (
      <section className="mt-6 rounded-2xl border border-line bg-paper p-5">
        <h2 className="font-display text-2xl text-ink">Microphone</h2>
        <p className="mt-2 text-ink">
          The microphone listens only while a word is on the screen. It does not record or save the sound. Allow it once for this sitting.
        </p>
        <button type="button" onClick={allowMic} className="mt-4 min-h-11 rounded-xl bg-accent px-5 font-semibold text-accent-ink">
          Allow the microphone
        </button>
      </section>
    );
  }

  const shown = phase !== "speak";

  return (
    <section className="mt-6" aria-live="polite">
      <p className="text-center text-xs tracking-wide text-muted uppercase">{listening ? "Listening" : "Sight word"}</p>
      <div className={phase === "sparkle" ? "sight-sparkle relative mt-4" : "relative mt-4"}>
        {shown ? (
          <p className="sight-word font-display font-semibold" style={{ color: colorFor(word) }}>
            {word}
          </p>
        ) : (
          <p className="sight-word font-display text-muted"> </p>
        )}
      </div>
      {unsupported ? (
        <div className="mt-6">
          <p className="text-sm text-ink">Speech recognition is not available on this device. An adult can mark this word.</p>
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
