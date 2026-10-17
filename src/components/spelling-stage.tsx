import { useEffect, useRef, useState } from "react";
import {
  SPELLING_HAPPY_FACE_MS,
  SPELLING_LETTER_MS,
  SPELLING_RESPONSE_MS,
  alphabet,
  letterAtSongTime,
  letterColors,
  letterView,
  micListensDuring,
} from "@/lib/vkole/spelling/items";
import { judgeSpellingSpoken } from "@/lib/vkole/spelling/match";

const MIC_KEY = "vkole-sp-mic";

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
type Phase = "song" | "prompt" | "listen" | "happy";

function recognitionCtor(): (new () => SpeechListener) | null {
  if (typeof window === "undefined") return null;
  const host = window as Window & {
    SpeechRecognition?: new () => SpeechListener;
    webkitSpeechRecognition?: new () => SpeechListener;
  };
  return host.SpeechRecognition ?? host.webkitSpeechRecognition ?? null;
}

function canSpeak(): boolean {
  return typeof window !== "undefined" && !!window.speechSynthesis;
}

function speakLine(line: string, done: () => void) {
  if (!canSpeak() || !line.trim()) {
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
  const utter = new SpeechSynthesisUtterance(line);
  utter.lang = "en-US";
  utter.rate = 0.95;
  utter.onend = finish;
  utter.onerror = finish;
  window.speechSynthesis.speak(utter);
}

function HappyFace() {
  return (
    <svg className="sp-happy" viewBox="0 0 120 120" role="img" aria-label="Happy Face">
      <circle cx="60" cy="60" r="54" fill="#f6c945" />
      <circle cx="42" cy="50" r="7" fill="#1d2420" />
      <circle cx="78" cy="50" r="7" fill="#1d2420" />
      <path d="M36 68c8 18 40 18 48 0" fill="none" stroke="#1d2420" strokeWidth="6" strokeLinecap="round" />
    </svg>
  );
}

export function SpellingStage({
  index = 0,
  silence = 0,
  wrong = 0,
  skipSong = false,
  onSongDone,
  onDone,
}: {
  index?: number;
  silence?: number;
  wrong?: number;
  skipSong?: boolean;
  onSongDone?: () => void;
  onDone: (outcome: Outcome) => void;
}) {
  const view = letterView({ index, silence, wrong });
  const token = `${view.id}:${view.silence}:${view.wrong}`;
  const letters = alphabet();
  const colors = letterColors();
  const [ready, setReady] = useState(false);
  const [unsupported, setUnsupported] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [phase, setPhase] = useState<Phase>(skipSong ? "prompt" : "song");
  const [songIndex, setSongIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(SPELLING_RESPONSE_MS / 1000);
  const onDoneRef = useRef(onDone);
  const onSongDoneRef = useRef(onSongDone);
  const viewRef = useRef(view);
  const finishRef = useRef<(outcome: Outcome) => void>(() => {});
  const advanceRef = useRef(0);
  const seen = useRef(token);
  onDoneRef.current = onDone;
  onSongDoneRef.current = onSongDone;
  viewRef.current = view;

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
    if (seen.current === token) return;
    seen.current = token;
    setPhase((current) => (current === "song" ? current : "prompt"));
  }, [token]);

  useEffect(() => {
    if (phase !== "song") return;
    let live = true;
    let ticks = 0;
    setSongIndex(0);
    speakLine(letters[0] ?? "A", () => {});
    const timer = window.setInterval(() => {
      ticks += 1;
      const frame = letterAtSongTime(ticks * SPELLING_LETTER_MS);
      if (!live) return;
      if (frame.done) {
        window.clearInterval(timer);
        window.speechSynthesis?.cancel();
        onSongDoneRef.current?.();
        setPhase("prompt");
        return;
      }
      setSongIndex(frame.index);
      speakLine(frame.letter, () => {});
    }, SPELLING_LETTER_MS);
    return () => {
      live = false;
      window.clearInterval(timer);
      window.speechSynthesis?.cancel();
    };
  }, [letters, phase]);

  const listening = ready && !unsupported && allowed && micListensDuring(phase);
  const canScore = ready && phase === "listen" && (unsupported || allowed);

  useEffect(() => {
    if (!ready || phase !== "prompt") return;
    let live = true;
    speakLine(view.say, () => {
      if (live) setPhase("listen");
    });
    return () => {
      live = false;
      window.speechSynthesis?.cancel();
    };
  }, [token, view.say, phase, ready]);

  useEffect(() => {
    if (!canScore) return;
    let live = true;
    const settled = { current: false };
    let rec: SpeechListener | null = null;
    setSecondsLeft(SPELLING_RESPONSE_MS / 1000);
    const timer = window.setTimeout(() => finishRef.current("timeout"), SPELLING_RESPONSE_MS);
    const ticker = window.setInterval(() => {
      setSecondsLeft((left) => (left > 0 ? left - 1 : 0));
    }, 1000);

    finishRef.current = (outcome: Outcome) => {
      if (!live || settled.current) return;
      settled.current = true;
      window.clearTimeout(timer);
      window.clearInterval(ticker);
      try {
        rec?.abort();
      } catch {
        /* already stopped */
      }
      rec = null;
      window.clearTimeout(advanceRef.current);
      if (outcome === "correct") {
        setPhase("happy");
        advanceRef.current = window.setTimeout(() => onDoneRef.current("correct"), SPELLING_HAPPY_FACE_MS);
        return;
      }
      onDoneRef.current(outcome);
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
          const current = viewRef.current;
          for (let i = start; i < event.results.length; i += 1) {
            const result = event.results[i];
            if (!result) continue;
            for (let j = 0; j < result.length; j += 1) {
              const transcript = result[j]?.transcript ?? "";
              if (transcript.trim().length === 0) continue;
              const judged = judgeSpellingSpoken(current.answer, transcript, Boolean(result.isFinal), current.also);
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
      window.clearInterval(ticker);
      try {
        rec?.abort();
      } catch {
        /* already stopped */
      }
    };
  }, [canScore, token, listening]);

  useEffect(() => {
    return () => {
      window.clearTimeout(advanceRef.current);
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    };
  }, [token]);

  function allowMic() {
    try {
      window.sessionStorage.setItem(MIC_KEY, "1");
    } catch {
      /* storage may be unavailable */
    }
    setAllowed(true);
  }

  if (!ready) return <p className="mt-6 text-sm text-muted">VKOLE/Spelling ZPD</p>;

  if (phase === "song") {
    const swatch = colors[songIndex] ?? colors[0];
    const letter = letters[songIndex] ?? "A";
    return (
      <section className="sp-review" style={{ background: swatch?.background }} aria-label="Alphabet song">
        <p className="sp-letter font-display" style={{ color: swatch?.letter }}>
          {letter}
        </p>
      </section>
    );
  }

  const shownSwatch = view.shown ? colors[letters.indexOf(view.shown)] : undefined;
  const needsMic = phase === "listen" && !unsupported && !allowed;
  const background = view.kind === "ask" && shownSwatch ? shownSwatch.background : undefined;

  return (
    <section className="sp-review" style={background ? { background } : undefined} aria-live="polite">
      <p className="text-center text-xs tracking-wide text-muted uppercase">
        {phase === "prompt" ? "Speaking" : phase === "listen" ? "Listening" : "Happy Face"}
      </p>
      {phase === "happy" ? (
        <HappyFace />
      ) : view.kind === "cue" ? (
        <div className="sp-cue" aria-label={view.show}>
          {view.cue.map((glyph) => {
            const swatch = colors[letters.indexOf(glyph)];
            return (
              <p key={glyph} className="sp-letter font-display" style={{ color: swatch?.letter ?? "#1d2420" }}>
                {glyph}
              </p>
            );
          })}
        </div>
      ) : (
        <>
          {view.shown ? (
            <p className="sp-letter font-display" style={{ color: shownSwatch?.letter }}>
              {view.shown}
            </p>
          ) : null}
          <p className="sp-prompt">{view.show}</p>
        </>
      )}
      {phase === "listen" && !needsMic ? <p className="mt-3 text-center text-sm text-muted">{secondsLeft} seconds</p> : null}
      {needsMic ? (
        <div className="mt-6 max-w-md text-center">
          <h2 className="font-display text-2xl text-ink">Microphone</h2>
          <p className="mt-2 text-ink">
            The microphone listens only while a prompt is waiting for an answer. It does not record or save the sound. Allow it once for this sitting.
          </p>
          <button type="button" onClick={allowMic} className="mt-4 min-h-11 rounded-xl bg-accent px-5 font-semibold text-accent-ink">
            Allow the microphone
          </button>
        </div>
      ) : null}
      {phase === "listen" && !needsMic ? (
        unsupported ? (
          <div className="mt-6 w-full max-w-md">
            <p className="text-sm text-ink">Speech recognition is not available on this device. An adult can mark this answer.</p>
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
        )
      ) : null}
    </section>
  );
}
