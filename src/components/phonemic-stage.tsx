import { useEffect, useRef, useState } from "react";
import { ListeningCue } from "@/components/listening-cue";
import { holdEngineMic, noteEngineActivity } from "@/lib/engine-activity";
import { LISTENING_BEST, PARENT_NEEDS_VOICE, PHONE_CANNOT_HEAR } from "@/lib/voice-consent";
import { voiceAllowedNow } from "@/lib/voice-consent-api";
import { answerWindowLeft, cueOnListenStart, quietRestart } from "@/lib/speech/answer-window";
import { chimeAllowed, playHeldChime, releaseBeepMute, releaseBeepMuteSoon } from "@/lib/speech/chime";
import {
  MIC_DENIED_LINE,
  PA_NEEDS_SOUND_LINE,
  askMicrophone,
  createListener,
  isNativeApp,
  listenFailureLine,
  listenKind,
  listenerReady,
  setCannotSpeakHook,
  speakAloud,
  stopSpeaking,
} from "@/lib/speech/listener";
import { PA_ADVANCE_MS, PA_MAX_SHOW_MS, itemAt, migratePaBand, type PaBand } from "@/lib/vkole/phonemic-awareness/items";
import { judgePaSpoken } from "@/lib/vkole/phonemic-awareness/match";
import { speechTokens } from "@/lib/vkole/sight-words/match";

type SpeechAlternative = { transcript?: string };
type SpeechResult = ArrayLike<SpeechAlternative> & { isFinal?: boolean };
type SpeechEvent = { resultIndex?: number; results: ArrayLike<SpeechResult> };
type SpeechListener = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: (() => void) | null;
  onaudiostart: (() => void) | null;
  onresult: ((event: SpeechEvent) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  allowForSilence: number;
  start: () => void;
  abort: () => void;
};

type Outcome = "correct" | "miss" | "timeout";

function canSpeak(): boolean {
  return isNativeApp() || (typeof window !== "undefined" && !!window.speechSynthesis);
}

function speakLine(line: string, done: () => void): () => void {
  return speakAloud(line, done, { rate: 0.9, capMs: 20000 });
}

export function PhonemicStage({
  band,
  index = 0,
  voiceAllowed = false,
  onDone,
}: {
  band?: string;
  index?: number;
  voiceAllowed?: boolean;
  onDone: (outcome: Outcome) => void;
}) {
  const resolved: PaBand = migratePaBand(band) ?? "WA";
  const item = itemAt(resolved, index);
  const [ready, setReady] = useState(false);
  const [unsupported, setUnsupported] = useState(false);
  const [phase, setPhase] = useState<"prompt" | "listen" | "sparkle" | "model">("prompt");
  const [spoken, setSpoken] = useState(true);
  const [listenNote, setListenNote] = useState(PHONE_CANNOT_HEAR);
  const [quiet, setQuiet] = useState(false);
  const [permit, setPermit] = useState<"wait" | "ready" | "denied">("wait");
  const [hearing, setHearing] = useState(false);
  const shownAt = useRef<number | null>(null);
  const holdingMic = useRef(false);
  const onDoneRef = useRef(onDone);
  const itemRef = useRef(item);
  const finishRef = useRef<(outcome: Outcome) => void>(() => {});
  const advanceRef = useRef(0);
  onDoneRef.current = onDone;
  itemRef.current = item;

  useEffect(() => {
    const supported = listenerReady();
    setUnsupported(!supported);
    setSpoken(canSpeak());
    setReady(true);
  }, []);

  useEffect(() => {
    setPhase("prompt");
    setHearing(false);
    shownAt.current = null;
    if (!voiceAllowed) {
      holdingMic.current = false;
      setPermit("ready");
      return;
    }
    holdingMic.current = true;
    setPermit("wait");
    let live = true;
    void askMicrophone().then((answer) => {
      if (!live) return;
      holdingMic.current = false;
      if (answer === "denied") {
        setListenNote(MIC_DENIED_LINE);
        setUnsupported(true);
        setPermit("denied");
        setPhase("listen");
        return;
      }
      setPermit("ready");
    });
    return () => {
      live = false;
    };
  }, [item.id, voiceAllowed]);

  useEffect(() => {
    noteEngineActivity();
  }, [phase, item.id]);

  useEffect(() => setCannotSpeakHook(() => {
    setQuiet(true);
    setSpoken(false);
  }), []);

  // The microphone is on only while the child should answer. It stays off while the prompt or the model is spoken.
  const listening = ready && !unsupported && voiceAllowed && phase === "listen";
  const waiting = ready && (unsupported || voiceAllowed || !voiceAllowed) && (phase === "prompt" || phase === "listen");

  useEffect(() => {
    if (!listening) return;
    return holdEngineMic();
  }, [listening]);

  useEffect(() => {
    if (!ready || !waiting || phase !== "prompt") return;
    if (voiceAllowed && permit !== "ready") return;
    if (voiceAllowed && holdingMic.current) return;
    let live = true;
    const stop = speakLine(item.say, () => {
      if (live) setPhase("listen");
    });
    return () => {
      live = false;
      stop();
      stopSpeaking();
    };
  }, [item.say, permit, phase, ready, voiceAllowed, waiting]);

  useEffect(() => {
    if (!ready || phase !== "listen") return;
    let live = true;
    const settled = { current: false };
    let rec: SpeechListener | null = null;
    let timer = 0;

    finishRef.current = (outcome: Outcome) => {
      if (!live || settled.current) return;
      settled.current = true;
      window.clearTimeout(timer);
      setHearing(false);
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

    if (voiceAllowed && (permit === "wait" || holdingMic.current)) {
      return () => {
        live = false;
      };
    }

    if (!(voiceAllowed && permit === "denied")) {
      if (shownAt.current == null) shownAt.current = performance.now();
      const left = answerWindowLeft(shownAt.current, performance.now(), PA_MAX_SHOW_MS);
      timer = window.setTimeout(() => finishRef.current("timeout"), left);
    }

    if (listening && permit === "ready") {
      void voiceAllowedNow().then(async (ok) => {
        if (!live || settled.current || !ok) return;
        const ear = createListener();
        if (!ear) return;
        rec = ear;
        rec.lang = "en-US";
        rec.continuous = true;
        rec.interimResults = true;
        rec.onstart = () => {
          if (cueOnListenStart(isNativeApp(), "started")) setHearing(true);
        };
        rec.onaudiostart = () => {
          if (cueOnListenStart(isNativeApp(), "audio")) setHearing(true);
        };
        rec.onresult = (event) => {
          noteEngineActivity();
          const start = event.resultIndex ?? 0;
          for (let i = start; i < event.results.length; i += 1) {
            const result = event.results[i];
            if (!result) continue;
            for (let j = 0; j < result.length; j += 1) {
              const transcript = result[j]?.transcript ?? "";
              if (speechTokens(transcript).length === 0) continue;
              const judged = judgePaSpoken(itemRef.current, transcript, Boolean(result.isFinal));
              if (judged === "wait") continue;
              finishRef.current(judged);
              return;
            }
          }
        };
        rec.onerror = (event) => {
          const kind = listenKind(event.error);
          if (!kind) return;
          setListenNote(kind === "denied" ? MIC_DENIED_LINE : listenFailureLine(kind));
          setHearing(false);
          setUnsupported(true);
        };
        rec.onend = () => {
          noteEngineActivity();
          if (!live || settled.current || shownAt.current == null) {
            setHearing(false);
            return;
          }
          const plan = quietRestart(shownAt.current, performance.now(), PA_MAX_SHOW_MS);
          if (!plan.restart) {
            setHearing(false);
            return;
          }
          ear.allowForSilence = plan.allowForSilence;
          try {
            ear.start();
          } catch {
            setHearing(false);
          }
        };
        const opened = quietRestart(shownAt.current ?? performance.now(), performance.now(), PA_MAX_SHOW_MS);
        ear.allowForSilence = opened.allowForSilence > 0 ? opened.allowForSilence : 1;
        const allowed = await chimeAllowed("listen");
        if (!live || settled.current) return;
        if (allowed) setHearing(true);
        await playHeldChime(allowed);
        if (!live || settled.current) {
          releaseBeepMute();
          return;
        }
        try {
          ear.start();
        } catch {
          setUnsupported(true);
        }
        releaseBeepMuteSoon();
      });
    }

    return () => {
      live = false;
      window.clearTimeout(timer);
      setHearing(false);
      try {
        rec?.abort();
      } catch {
        /* already stopped */
      }
    };
  }, [item.id, listening, permit, phase, ready, voiceAllowed]);

  useEffect(() => {
    return () => {
      window.clearTimeout(advanceRef.current);
      stopSpeaking();
    };
  }, [item.id]);

  if (!ready) return <p className="mt-6 text-sm text-muted">Phonemic awareness</p>;

  const showModel = phase === "model" && !spoken;
  const adult = phase === "listen" && (!voiceAllowed || unsupported);

  return (
    <section className="mt-6" aria-live="polite">
      <p className="text-center text-sm text-ink">{LISTENING_BEST}</p>
      {quiet ? (
        <div className="mt-4 text-center">
          <p className="text-sm text-ink">{PA_NEEDS_SOUND_LINE}</p>
          <p className="mt-2 text-lg text-ink">{item.say}</p>
        </div>
      ) : null}
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
      ) : null}
      <p className="text-center text-xs tracking-wide text-muted uppercase">
        {phase === "prompt" ? "Speaking" : phase === "sparkle" ? "Heard" : phase === "listen" ? "Answer" : "Answer"}
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
      <ListeningCue on={hearing && phase === "listen"} />
    </section>
  );
}
