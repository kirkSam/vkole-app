import { useEffect, useRef, useState } from "react";
import { PA_ADVANCE_MS, PA_MAX_SHOW_MS, itemAt, isPaBand, type PaBand } from "@/lib/vkole/phonemic-awareness/items";
import { judgePaSpoken } from "@/lib/vkole/phonemic-awareness/match";

const MIC_KEY = "vkole-pa-mic";

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

function canSpeak(): boolean {
  return typeof window !== "undefined" && !!window.speechSynthesis;
}

function speakLine(line: string, done: () => void) {
  if (!canSpeak()) {
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
  const cap = window.setTimeout(finish, 20000);
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(line);
  utter.lang = "en-US";
  utter.rate = 0.9;
  utter.onend = finish;
  utter.onerror = finish;
  window.speechSynthesis.speak(utter);
}

export function PhonemicStage({
  band,
  index = 0,
  onDone,
}: {
  band?: string;
  index?: number;
  onDone: (outcome: Outcome) => void;
}) {
  const resolved: PaBand = isPaBand(band) ? band : "WA";
  const item = itemAt(resolved, index);
  const [ready, setReady] = useState(false);
  const [unsupported, setUnsupported] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [phase, setPhase] = useState<"prompt" | "listen" | "sparkle" | "model">("prompt");
  const [spoken, setSpoken] = useState(true);
  const onDoneRef = useRef(onDone);
  const itemRef = useRef(item);
  const finishRef = useRef<(outcome: Outcome) => void>(() => {});
  const advanceRef = useRef(0);
  onDoneRef.current = onDone;
  itemRef.current = item;

  useEffect(() => {
    const supported = recognitionCtor() != null;
    setUnsupported(!supported);
    try {
      setAllowed(window.sessionStorage.getItem(MIC_KEY) === "1");
    } catch {
      setAllowed(false);
    }
    setSpoken(canSpeak());
    setReady(true);
  }, []);

  useEffect(() => {
    setPhase("prompt");
  }, [item.id]);

  const listening = ready && !unsupported && allowed && phase === "listen";
  const waiting = ready && (unsupported || allowed) && (phase === "prompt" || phase === "listen");

  useEffect(() => {
    if (!ready || !waiting || phase !== "prompt") return;
    let live = true;
    speakLine(item.say, () => {
      if (live) setPhase("listen");
    });
    return () => {
      live = false;
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    };
  }, [item.say, phase, ready, waiting]);

  useEffect(() => {
    if (!ready || phase !== "listen") return;
    let live = true;
    const settled = { current: false };
    let rec: SpeechListener | null = null;
    const timer = window.setTimeout(() => finishRef.current("timeout"), PA_MAX_SHOW_MS);

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
      const current = itemRef.current;
      if (outcome === "correct") {
        setPhase("sparkle");
        advanceRef.current = window.setTimeout(() => onDoneRef.current("correct"), PA_ADVANCE_MS);
        return;
      }
      setPhase("model");
      speakLine(current.model, () => {
        advanceRef.current = window.setTimeout(() => onDoneRef.current(outcome), PA_ADVANCE_MS);
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
              const transcript = result[j]?.transcript ?? "";
              const judged = judgePaSpoken(itemRef.current, transcript, Boolean(result.isFinal));
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
  }, [item.id, listening, phase, ready]);

  useEffect(() => {
    return () => {
      window.clearTimeout(advanceRef.current);
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    };
  }, [item.id]);

  function allowMic() {
    try {
      window.sessionStorage.setItem(MIC_KEY, "1");
    } catch {
      /* storage may be unavailable */
    }
    setAllowed(true);
  }

  if (!ready) return <p className="mt-6 text-sm text-muted">Phonemic awareness</p>;

  if (!unsupported && !allowed) {
    return (
      <section className="mt-6 rounded-2xl border border-line bg-paper p-5">
        <h2 className="font-display text-2xl text-ink">Microphone</h2>
        <p className="mt-2 text-ink">
          The microphone listens only while a prompt is waiting for an answer. It does not record or save the sound. Allow it once for this sitting.
        </p>
        <button type="button" onClick={allowMic} className="mt-4 min-h-11 rounded-xl bg-accent px-5 font-semibold text-accent-ink">
          Allow the microphone
        </button>
      </section>
    );
  }

  const showModel = phase === "model" && !spoken;

  return (
    <section className="mt-6" aria-live="polite">
      <p className="text-center text-xs tracking-wide text-muted uppercase">
        {phase === "prompt" ? "Speaking" : phase === "listen" ? "Listening" : phase === "sparkle" ? "Heard" : "Answer"}
      </p>
      <div className={phase === "sparkle" ? "sight-sparkle relative mt-4 min-h-16" : "relative mt-4 min-h-16"}>
        {phase === "listen" || phase === "prompt" ? <p className="text-center text-lg text-ink">{item.say}</p> : null}
        {showModel ? <p className="text-center text-lg text-ink">{item.model}</p> : null}
        {item.boxes > 0 && phase === "listen" ? (
          <div className="mt-4 flex justify-center gap-2" aria-label="Elkonin boxes">
            {Array.from({ length: item.boxes }, (_, box) => (
              <span key={box} className="pa-box" />
            ))}
          </div>
        ) : null}
      </div>
      {phase === "listen" ? (
        <div className="mt-6">
          <p className="text-sm text-ink">An adult marks what the child said out loud.</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <button type="button" onClick={() => finishRef.current("correct")} className="min-h-11 flex-1 rounded-xl bg-accent px-5 font-semibold text-accent-ink">
              They said it right
            </button>
            <button type="button" onClick={() => finishRef.current("miss")} className="min-h-11 flex-1 rounded-xl border border-ink bg-paper px-5 font-semibold text-ink">
              Not yet
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
