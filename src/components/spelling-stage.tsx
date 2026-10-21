import { useEffect, useRef, useState } from "react";
import {
  SPELLING_HAPPY_FACE_MS,
  SPELLING_LETTER_MS,
  SPELLING_LISTEN_GAP_MS,
  SPELLING_RECOGNIZER_RESTART_MS,
  SPELLING_RESPONSE_MS,
  alphabet,
  applyLetterAnswer,
  exerciseStartIndex,
  letterAtSongTime,
  letterColors,
  earlyHandoffMiss,
  letterExercise,
  letterView,
  openingAlphabetExercise,
  micListensDuring,
  type AlphabetExercise,
  promptPlayedLongEnough,
  spellingPromptStartsListen,
  spellingStartSecondsLeft,
} from "@/lib/vkole/spelling/items";
import { holdEngineAudio, holdEngineMic, noteEngineActivity } from "@/lib/engine-activity";
import { describeSpellingHear, recognitionErrorRelistens, spellingGrammar } from "@/lib/vkole/spelling/match";
import { celebrationFrame, GOOD_JOB_LINE, reciteHear, SPELLING_CELEBRATION_MS } from "@/lib/vkole/spelling/recite";
import { advanceTyping, judgeTypingKey, TYPING_TRY_AGAIN, TYPING_WAIT_MS, typingShown, typingStart, type TypingPlace } from "@/lib/vkole/spelling/typing";

const MIC_KEY = "vkole-sp-mic";

type SpeechAlternative = { transcript?: string };
type SpeechResult = ArrayLike<SpeechAlternative> & { isFinal?: boolean };
type SpeechEvent = { resultIndex?: number; results: ArrayLike<SpeechResult> };
type SpeechGrammarList = { addFromString: (source: string, weight: number) => void };

type SpeechListener = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  grammars: SpeechGrammarList | null;
  onresult: ((event: SpeechEvent) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  abort: () => void;
};

const HEARD_HOLD_MS = 1200;

function grammarCtor(): (new () => SpeechGrammarList) | null {
  if (typeof window === "undefined") return null;
  const host = window as Window & {
    SpeechGrammarList?: new () => SpeechGrammarList;
    webkitSpeechGrammarList?: new () => SpeechGrammarList;
  };
  return host.SpeechGrammarList ?? host.webkitSpeechGrammarList ?? null;
}

/** Bias the recognizer toward this letter when the browser still accepts a grammar. */
function applyLetterGrammar(rec: SpeechListener, answer: string, also: readonly string[]) {
  const Ctor = grammarCtor();
  const source = spellingGrammar(answer, also);
  if (!Ctor || !source) return;
  try {
    const list = new Ctor();
    list.addFromString(source, 1);
    rec.grammars = list;
  } catch {
    /* This browser has no speech grammar. Matching still uses every alternative. */
  }
}

type Outcome = "correct" | "miss" | "timeout";
type Phase = "gate" | "song" | "prompt" | "listen" | "happy" | "good-job" | "celebrate" | "type";

const EXERCISE_BUTTONS = [1, 2, 3, 4, 5, 6] as const;

function AlphabetJumps({ current, onPick }: { current: AlphabetExercise; onPick: (exercise: AlphabetExercise) => void }) {
  return (
    <div className="sp-jumps" role="group" aria-label="Exercises">
      {EXERCISE_BUTTONS.map((exercise) => (
        <button
          key={exercise}
          type="button"
          className={exercise === current ? "is-current" : undefined}
          aria-current={exercise === current ? "true" : undefined}
          aria-label={`Exercise ${exercise}`}
          onClick={() => onPick(exercise)}
        >
          {exercise}
        </button>
      ))}
    </div>
  );
}

const CONFETTI = [
  { left: "6%", bottom: "8%", delay: "0s", color: "#f6c945", size: "0.85rem" },
  { left: "18%", bottom: "22%", delay: "0.2s", color: "#ef6f6c", size: "0.55rem" },
  { left: "30%", bottom: "4%", delay: "0.45s", color: "#4c9be8", size: "0.7rem" },
  { left: "44%", bottom: "18%", delay: "0.1s", color: "#67b26f", size: "0.6rem" },
  { left: "56%", bottom: "6%", delay: "0.35s", color: "#f6c945", size: "0.95rem" },
  { left: "68%", bottom: "24%", delay: "0.55s", color: "#b07be0", size: "0.5rem" },
  { left: "80%", bottom: "10%", delay: "0.15s", color: "#ef6f6c", size: "0.75rem" },
  { left: "90%", bottom: "20%", delay: "0.4s", color: "#4c9be8", size: "0.6rem" },
];

let pendingSpeech: (() => void) | null = null;

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

function speakLine(line: string, done: () => void): () => void {
  if (!canSpeak() || !line.trim()) {
    noteEngineActivity();
    done();
    return () => {};
  }
  const release = holdEngineAudio();
  let finished = false;
  let kick = 0;
  let startTimer = 0;
  const synth = window.speechSynthesis;
  const finish = () => {
    if (finished) return;
    finished = true;
    window.clearTimeout(cap);
    window.clearInterval(kick);
    window.clearTimeout(startTimer);
    try {
      synth.cancel();
    } catch {
      /* A stuck speech queue must not swallow the callback that opens the microphone. */
    }
    release();
    done();
  };
  const cap = window.setTimeout(finish, 8000);
  const stop = () => {
    if (finished) return;
    finished = true;
    window.clearTimeout(cap);
    window.clearInterval(kick);
    window.clearTimeout(startTimer);
    synth.cancel();
    release();
  };
  pendingSpeech?.();
  pendingSpeech = stop;
  // cancel() and speak() in the same turn drops the utterance. Chrome also pauses the queue
  // after a run of letters, which is the stall that showed up around G and then recovered.
  synth.cancel();
  const utter = new SpeechSynthesisUtterance(line);
  utter.lang = "en-US";
  utter.rate = 0.95;
  utter.onend = finish;
  utter.onerror = finish;
  startTimer = window.setTimeout(() => {
    if (finished) return;
    try {
      if (synth.paused || synth.speaking) synth.resume();
    } catch {
      /* resume is best-effort after a long run of letters */
    }
    synth.speak(utter);
  }, 40);
  kick = window.setInterval(() => {
    if (!finished && synth.paused) synth.resume();
  }, 1000);
  return stop;
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
  heard = "",
  onHeard,
  onRecited,
  onDone,
}: {
  index?: number;
  silence?: number;
  wrong?: number;
  heard?: string;
  onHeard?: (note: string) => void;
  onRecited?: () => void;
  onDone: (outcome: Outcome) => void;
}) {
  const opening = openingAlphabetExercise({ index, silence, wrong });
  const [exercise, setExercise] = useState<AlphabetExercise>(opening);
  const [place, setPlace] = useState({ index: exerciseStartIndex(2), silence: 0, wrong: 0 });
  const [runToken, setRunToken] = useState(0);
  const placeRef = useRef(place);
  placeRef.current = place;
  const view = letterView(place);
  const letters = alphabet();
  const colors = letterColors();
  const [ready, setReady] = useState(false);
  const [unsupported, setUnsupported] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [phase, setPhase] = useState<Phase>("gate");
  const [typing, setTyping] = useState<TypingPlace>(typingStart());
  const [typeNote, setTypeNote] = useState("");
  const [typeDraft, setTypeDraft] = useState("");
  const [typeNudge, setTypeNudge] = useState(0);
  const [typeFinished, setTypeFinished] = useState(false);
  const token = `${place.index}:${place.silence}:${place.wrong}`;
  const [songIndex, setSongIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(SPELLING_RESPONSE_MS / 1000);
  const [heardNote, setHeardNote] = useState("");
  const [startIn, setStartIn] = useState(spellingStartSecondsLeft(0));
  const onDoneRef = useRef(onDone);
  const onHeardRef = useRef(onHeard);
  const onRecitedRef = useRef(onRecited);
  const typeRef = useRef<HTMLInputElement | null>(null);
  const typedDone = useRef(false);
  const heardRef = useRef("");
  const viewRef = useRef(view);
  const finishRef = useRef<(outcome: Outcome) => void>(() => {});
  const advanceRef = useRef(0);
  const reciteRef = useRef(0);
  const began = useRef(false);
  const seen = useRef(token);
  onDoneRef.current = onDone;
  onHeardRef.current = onHeard;
  onRecitedRef.current = onRecited;
  viewRef.current = view;

  function beginExercise(next: AlphabetExercise) {
    noteEngineActivity();
    window.speechSynthesis?.cancel();
    window.clearTimeout(advanceRef.current);
    setRunToken((value) => value + 1);
    heardRef.current = "";
    setHeardNote("");
    reciteRef.current = 0;
    setExercise(next);
    typedDone.current = false;
    if (next === 1) {
      setSongIndex(0);
      began.current = true;
      setPhase("song");
      return;
    }
    if (next === 6) {
      setTyping(typingStart());
      setTypeNote("");
      setTypeDraft("");
      setTypeNudge(0);
      setTypeFinished(false);
      setPhase("type");
      return;
    }
    const nextPlace = { index: exerciseStartIndex(next), silence: 0, wrong: 0 };
    placeRef.current = nextPlace;
    setPlace(nextPlace);
    setPhase("prompt");
  }

  function takeAnswer(outcome: Outcome) {
    if (outcome === "correct") {
      const answered = placeRef.current;
      setPhase("happy");
      window.clearTimeout(advanceRef.current);
      advanceRef.current = window.setTimeout(() => {
        if (placeRef.current !== answered) return;
        const after = applyLetterAnswer(answered, "correct");
        placeRef.current = after;
        setPlace(after);
        setExercise(letterExercise(after.index));
        setPhase("prompt");
      }, SPELLING_HAPPY_FACE_MS);
      return;
    }
    const after = applyLetterAnswer(placeRef.current, outcome);
    placeRef.current = after;
    setPlace(after);
    setExercise(letterExercise(after.index));
    setPhase("prompt");
  }

  function takeTyped(raw: string) {
    setTypeDraft("");
    if (phase !== "type" || typedDone.current) return;
    const judgment = judgeTypingKey(typingShown(typing), raw);
    if (judgment === "ignore") return;
    if (judgment === "correct") {
      const next = advanceTyping(typing);
      setTypeNote("");
      if (next.done) {
        typedDone.current = true;
        setTypeFinished(true);
        onDoneRef.current("correct");
        return;
      }
      setTyping(next.place);
      return;
    }
    setTypeNote(TYPING_TRY_AGAIN);
    speakLine(TYPING_TRY_AGAIN, () => {});
    setTypeNudge((value) => value + 1);
  }

  function noteHeard(note: string) {
    heardRef.current = note;
    setHeardNote(note);
    if (note) onHeardRef.current?.(note);
  }

  function noteSilence() {
    if (heardRef.current.startsWith("I heard:")) return;
    noteHeard("I didn't hear anything");
  }

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
    noteEngineActivity();
  }, [phase, token]);

  useEffect(() => {
    if (seen.current === token) return;
    seen.current = token;
    heardRef.current = "";
    setHeardNote("");
    reciteRef.current = 0;
    setPhase((current) => (current === "song" || current === "gate" || current === "happy" || current === "good-job" || current === "celebrate" ? current : "prompt"));
  }, [token]);

  function begin() {
    if (began.current) return;
    began.current = true;
    setExercise(1);
    setPhase("song");
  }

  useEffect(() => {
    if (!ready || phase !== "gate") return;
    const startedAt = performance.now();
    setStartIn(spellingStartSecondsLeft(0));
    const timer = window.setInterval(() => {
      const left = spellingStartSecondsLeft(performance.now() - startedAt);
      setStartIn((current) => (current === left ? current : left));
      if (left <= 0) begin();
    }, 200);
    return () => window.clearInterval(timer);
  }, [ready, phase]);

  useEffect(() => {
    if (phase !== "song") return;
    let live = true;
    let ticks = 0;
    let stopLine = speakLine(letters[0] ?? "A", () => {});
    setSongIndex(0);
    const timer = window.setInterval(() => {
      ticks += 1;
      noteEngineActivity();
      const songFrame = letterAtSongTime(ticks * SPELLING_LETTER_MS);
      if (!live) return;
      if (songFrame.done) {
        window.clearInterval(timer);
        stopLine();
        const nextPlace = { index: exerciseStartIndex(2), silence: 0, wrong: 0 };
        placeRef.current = nextPlace;
        setPlace(nextPlace);
        setExercise(2);
        setPhase("prompt");
        return;
      }
      setSongIndex(songFrame.index);
      stopLine = speakLine(songFrame.letter, () => {});
    }, SPELLING_LETTER_MS);
    return () => {
      live = false;
      window.clearInterval(timer);
      stopLine();
    };
  }, [letters, phase, runToken]);

  const listening = ready && !unsupported && allowed && micListensDuring(phase);
  const canScore = ready && phase === "listen" && (unsupported || allowed);

  useEffect(() => {
    if (!listening) return;
    return holdEngineMic();
  }, [listening]);

  useEffect(() => {
    if (!ready || phase !== "prompt") return;
    let live = true;
    let gapTimer = 0;
    let backup = 0;
    let opened = false;
    let attempts = 0;
    let started = 0;
    let stop = () => {};
    const listen = () => {
      if (!live || opened) return;
      opened = true;
      window.clearTimeout(backup);
      window.clearTimeout(gapTimer);
      gapTimer = window.setTimeout(() => {
        if (live) setPhase("listen");
      }, SPELLING_LISTEN_GAP_MS);
    };
    const beginSpeak = () => {
      if (!live || opened) return;
      stop();
      attempts += 1;
      started = performance.now();
      stop = speakLine(view.say, afterSpeech);
    };
    const afterSpeech = () => {
      if (!live || opened) return;
      const synth = window.speechSynthesis;
      if (synth && (synth.speaking || synth.pending)) {
        gapTimer = window.setTimeout(afterSpeech, SPELLING_LISTEN_GAP_MS);
        return;
      }
      // The first card after a handoff often ends the utterance immediately. Say it again
      // before the microphone opens, or the mic scores the previous letter.
      if (!promptPlayedLongEnough(performance.now() - started) && attempts < 3) {
        gapTimer = window.setTimeout(beginSpeak, SPELLING_LISTEN_GAP_MS);
        return;
      }
      listen();
    };
    // A missing letter on screen is not a reason to wait. A blank line opens the mic now.
    if (spellingPromptStartsListen(view.say) === "now") {
      if (live) setPhase("listen");
      return () => {
        live = false;
      };
    }
    beginSpeak();
    backup = window.setTimeout(listen, 8000);
    return () => {
      live = false;
      window.clearTimeout(backup);
      window.clearTimeout(gapTimer);
      stop();
    };
  }, [token, view.say, phase, ready, runToken]);

  useEffect(() => {
    if (!canScore) return;
    if (viewRef.current.exercise === 5) return;
    let live = true;
    const settled = { current: false };
    let rec: SpeechListener | null = null;
    let restartTimer = 0;
    let decided = false;
    const listenStarted = performance.now();
    const deadline = listenStarted + SPELLING_RESPONSE_MS;
    setSecondsLeft(SPELLING_RESPONSE_MS / 1000);
    const timer = window.setTimeout(() => {
      if (decided) return;
      decided = true;
      noteSilence();
      try {
        rec?.abort();
      } catch {
        /* already stopped */
      }
      if (live) finishRef.current("timeout");
    }, SPELLING_RESPONSE_MS);
    const ticker = window.setInterval(() => {
      const left = Math.max(0, Math.ceil((deadline - performance.now()) / 1000));
      setSecondsLeft((current) => (current === left ? current : left));
    }, 250);

    const scheduleRestart = () => {
      if (!live || settled.current || decided || !rec) return;
      window.clearTimeout(restartTimer);
      restartTimer = window.setTimeout(() => {
        if (!live || settled.current || decided || !rec) return;
        try {
          rec.start();
        } catch {
          scheduleRestart();
        }
      }, SPELLING_RECOGNIZER_RESTART_MS);
    };

    finishRef.current = (outcome: Outcome) => {
      if (!live || settled.current) return;
      settled.current = true;
      window.clearTimeout(timer);
      window.clearInterval(ticker);
      window.clearTimeout(restartTimer);
      try {
        rec?.abort();
      } catch {
        /* already stopped */
      }
      rec = null;
      window.clearTimeout(advanceRef.current);
      if (outcome === "correct") {
        takeAnswer("correct");
        return;
      }
      takeAnswer(outcome);
    };

    if (listening) {
      const Ctor = recognitionCtor();
      if (Ctor) {
        rec = new Ctor();
        rec.lang = "en-US";
        rec.continuous = true;
        rec.interimResults = true;
        rec.maxAlternatives = 8;
        applyLetterGrammar(rec, viewRef.current.answer, viewRef.current.also);
        rec.onresult = (event) => {
          noteEngineActivity();
          if (decided) return;
          const start = event.resultIndex ?? 0;
          const current = viewRef.current;
          let missNote = "";
          for (let i = start; i < event.results.length; i += 1) {
            const result = event.results[i];
            if (!result) continue;
            const alternatives: { transcript: string; final: boolean }[] = [];
            for (let j = 0; j < result.length; j += 1) {
              const row = result[j];
              if (!row) continue;
              alternatives.push({ transcript: row.transcript ?? "", final: Boolean(result.isFinal) });
            }
            const heard = describeSpellingHear(current.answer, alternatives, current.also, current.say);
            if (earlyHandoffMiss(performance.now() - listenStarted, heard.judgment)) continue;
            if (heard.status.startsWith("I heard:")) noteHeard(heard.status);
            if (heard.judgment === "correct") {
              decided = true;
              window.clearTimeout(timer);
              noteHeard(heard.status);
              finishRef.current("correct");
              return;
            }
            if (heard.judgment === "miss") missNote = heard.status;
          }
          if (!missNote) return;
          decided = true;
          window.clearTimeout(timer);
          noteHeard(missNote);
          try {
            rec?.abort();
          } catch {
            /* already stopped */
          }
          advanceRef.current = window.setTimeout(() => {
            if (live) finishRef.current("miss");
          }, HEARD_HOLD_MS);
        };
        rec.onerror = (event) => {
          if (event.error === "not-allowed" || event.error === "service-not-allowed") {
            setUnsupported(true);
            return;
          }
          if (event.error === "no-speech") {
            // Re-ask this same card. Restarting a recognizer that will not start again leaves the
            // "I didn't hear anything" line on screen until a later silence steps back to A.
            decided = true;
            noteSilence();
            window.clearTimeout(timer);
            window.clearTimeout(restartTimer);
            try {
              rec?.abort();
            } catch {
              /* already stopped */
            }
            if (live) setPhase("prompt");
            return;
          }
          if (recognitionErrorRelistens(event.error)) {
            scheduleRestart();
            return;
          }
        };
        rec.onend = () => {
          noteEngineActivity();
          if (!live || settled.current || decided || !rec) return;
          scheduleRestart();
        };
        try {
          rec.start();
        } catch {
          scheduleRestart();
        }
      }
    }

    return () => {
      live = false;
      window.clearTimeout(timer);
      window.clearInterval(ticker);
      window.clearTimeout(restartTimer);
      try {
        rec?.abort();
      } catch {
        /* already stopped */
      }
    };
  }, [canScore, token, listening]);

  useEffect(() => {
    if (!canScore || viewRef.current.exercise !== 5) return;
    let live = true;
    let rec: SpeechListener | null = null;
    let restartTimer = 0;
    const scheduleRestart = () => {
      if (!live || !rec) return;
      window.clearTimeout(restartTimer);
      restartTimer = window.setTimeout(() => {
        if (!live || !rec) return;
        try {
          rec.start();
        } catch {
          scheduleRestart();
        }
      }, SPELLING_RECOGNIZER_RESTART_MS);
    };
    const celebrate = () => {
      if (!live) return;
      live = false;
      window.clearTimeout(restartTimer);
      try {
        rec?.abort();
      } catch {
        /* already stopped */
      }
      setPhase("good-job");
    };
    finishRef.current = (outcome: Outcome) => {
      if (!live) return;
      if (outcome === "correct") {
        celebrate();
        return;
      }
      reciteRef.current = 0;
      noteHeard("");
    };
    if (listening) {
      const Ctor = recognitionCtor();
      if (Ctor) {
        rec = new Ctor();
        rec.lang = "en-US";
        rec.continuous = true;
        rec.interimResults = true;
        rec.maxAlternatives = 8;
        applyLetterGrammar(rec, "A", []);
        rec.onresult = (event) => {
          noteEngineActivity();
          if (!live) return;
          const start = event.resultIndex ?? 0;
          const say = viewRef.current.say;
          let next = reciteRef.current;
          for (let i = start; i < event.results.length; i += 1) {
            const result = event.results[i];
            if (!result) continue;
            let bestNext = next;
            let bestStatus = "";
            for (let j = 0; j < result.length; j += 1) {
              const row = result[j];
              const heard = reciteHear({ next }, row?.transcript ?? "", say);
              if (heard.next > bestNext) {
                bestNext = heard.next;
                bestStatus = heard.status;
              } else if (heard.next === bestNext && !bestStatus) bestStatus = heard.status;
            }
            if (bestNext > next) {
              next = bestNext;
              noteHeard(`I heard: ${alphabet().slice(0, next).join(" ")}`);
            } else if (bestStatus.startsWith("I heard:") && !heardRef.current.startsWith("I heard:")) {
              noteHeard(bestStatus);
            }
          }
          reciteRef.current = next;
          if (next >= alphabet().length) celebrate();
        };
        rec.onerror = (event) => {
          if (event.error === "not-allowed" || event.error === "service-not-allowed") {
            setUnsupported(true);
            return;
          }
          if (recognitionErrorRelistens(event.error)) {
            scheduleRestart();
          }
        };
        rec.onend = () => {
          noteEngineActivity();
          if (!live || !rec) return;
          scheduleRestart();
        };
        try {
          rec.start();
        } catch {
          scheduleRestart();
        }
      }
    }
    return () => {
      live = false;
      window.clearTimeout(restartTimer);
      try {
        rec?.abort();
      } catch {
        /* already stopped */
      }
    };
  }, [canScore, token, listening]);

  useEffect(() => {
    if (phase !== "good-job") return;
    let live = true;
    const stop = speakLine(GOOD_JOB_LINE, () => {
      if (live) setPhase("celebrate");
    });
    return () => {
      live = false;
      stop();
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== "celebrate") return;
    let live = true;
    const started = performance.now();
    const finish = (elapsed: number) => {
      if (!live || celebrationFrame(elapsed) !== "done") return;
      live = false;
      onRecitedRef.current?.();
      typedDone.current = false;
      setTyping(typingStart());
      setTypeNote("");
      setTypeDraft("");
      setTypeNudge(0);
      setTypeFinished(false);
      setExercise(6);
      setPhase("type");
    };
    const timer = window.setInterval(() => finish(performance.now() - started), 100);
    const backup = window.setTimeout(() => finish(SPELLING_CELEBRATION_MS), SPELLING_CELEBRATION_MS);
    return () => {
      live = false;
      window.clearInterval(timer);
      window.clearTimeout(backup);
    };
  }, [phase]);

  useEffect(() => {
    return () => {
      window.clearTimeout(advanceRef.current);
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    };
  }, [token]);

  useEffect(() => {
    if (phase !== "type" || typeFinished) return;
    let live = true;
    const timer = window.setTimeout(() => {
      if (!live) return;
      setTypeNote(TYPING_TRY_AGAIN);
      speakLine(TYPING_TRY_AGAIN, () => {});
      setTypeNudge((value) => value + 1);
    }, TYPING_WAIT_MS);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [phase, typing.index, typing.letterCase, typeNudge, typeFinished]);

  useEffect(() => {
    if (phase !== "type") return;
    typeRef.current?.focus();
  }, [phase, typing.index, typing.letterCase]);

  function allowMic() {
    try {
      window.sessionStorage.setItem(MIC_KEY, "1");
    } catch {
      /* storage may be unavailable */
    }
    setAllowed(true);
  }

  if (!ready) return <p className="mt-6 text-sm text-muted">VKOLE/Alphabet ZPD</p>;

  if (phase === "gate") {
    const swatch = colors[0];
    const letter = letters[0] ?? "A";
    return (
      <section className="sp-review" style={{ background: swatch?.background }} aria-label="Start alphabet">
        <AlphabetJumps current={1} onPick={beginExercise} />
        <p className="text-center text-base font-semibold text-ink">Exercise 1</p>
        <p className="sp-letter font-display" style={{ color: swatch?.letter }}>
          {letter}
        </p>
        <button type="button" onClick={begin} className="mt-4 min-h-11 rounded-xl bg-accent px-5 font-semibold text-accent-ink">
          START
        </button>
        <p className="mt-3 text-center text-sm text-muted">
          {startIn === 1 ? "Starts in 1 second" : `Starts in ${startIn} seconds`}
        </p>
      </section>
    );
  }

  if (phase === "song") {
    const swatch = colors[songIndex] ?? colors[0];
    const letter = letters[songIndex] ?? "A";
    return (
      <section className="sp-review" style={{ background: swatch?.background }} aria-label="Alphabet song">
        <AlphabetJumps current={1} onPick={beginExercise} />
        <p className="text-center text-base font-semibold text-ink">Exercise 1</p>
        <p className="sp-letter font-display" style={{ color: swatch?.letter }}>
          {letter}
        </p>
      </section>
    );
  }

  if (phase === "type") {
    const shown = typingShown(typing);
    const swatch = colors[letters.indexOf(shown.toUpperCase())] ?? colors[0];
    return (
      <section className="sp-review" style={{ background: swatch?.background }} aria-label="Type the letter" onClick={() => typeRef.current?.focus()}>
        <AlphabetJumps current={6} onPick={beginExercise} />
        <p className="text-center text-base font-semibold text-ink">Exercise 6</p>
        <p className="sp-letter font-display" style={{ color: swatch?.letter }}>
          {shown}
        </p>
        {typeNote ? (
          <p className="sp-prompt" role="status">
            {typeNote}
          </p>
        ) : null}
        <input
          ref={typeRef}
          className="sp-type"
          type="text"
          inputMode="text"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoComplete="off"
          enterKeyHint="done"
          aria-label={`Type ${shown}`}
          value={typeDraft}
          onChange={(event) => takeTyped(event.target.value)}
        />
      </section>
    );
  }

  const shownSwatch = view.shown ? colors[letters.indexOf(view.shown.toUpperCase())] : undefined;
  const pairSwatch = colors[letters.indexOf(view.letter)] ?? colors[0];
  const needsMic = phase === "listen" && !unsupported && !allowed;
  const background = view.kind === "ask" && shownSwatch ? shownSwatch.background : undefined;
  const status = phase === "prompt" ? "Speaking" : phase === "listen" ? "Listening" : phase === "good-job" || phase === "celebrate" ? "Good job" : "Happy Face";

  return (
    <section className="sp-review" style={background ? { background } : undefined} aria-live="polite">
      <AlphabetJumps current={exercise} onPick={beginExercise} />
      <p className="text-center text-base font-semibold text-ink">Exercise {view.exercise}</p>
      <p className="text-center text-xs tracking-wide text-muted uppercase">{status}</p>
      {phase === "celebrate" ? (
        <div className="sp-celebrate" aria-label={GOOD_JOB_LINE}>
          <p className="sp-prompt">{GOOD_JOB_LINE}</p>
          <div className="sp-confetti" aria-hidden="true">
            {CONFETTI.map((piece) => (
              <span
                key={`${piece.left}-${piece.delay}`}
                className="sp-star"
                style={{
                  left: piece.left,
                  bottom: piece.bottom,
                  animationDelay: piece.delay,
                  background: piece.color,
                  width: piece.size,
                  height: piece.size,
                }}
              />
            ))}
          </div>
        </div>
      ) : phase === "good-job" ? (
        <p className="sp-prompt">{GOOD_JOB_LINE}</p>
      ) : phase === "happy" ? (
        <>
          {view.pair ? (
            <div className="sp-pair" aria-label={view.pair}>
              {view.pair.split(" ").map((glyph) => (
                <p key={glyph} className="sp-letter font-display" style={{ color: pairSwatch?.letter }}>
                  {glyph}
                </p>
              ))}
            </div>
          ) : null}
          <HappyFace />
        </>
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
      {phase === "listen" && !needsMic && view.exercise !== 5 ? (
        <p className="mt-3 text-center text-sm text-muted">{secondsLeft} seconds</p>
      ) : null}
      {(heardNote || heard) && (phase === "prompt" || phase === "listen" || phase === "happy") ? (
        <p className="mt-2 text-center text-sm text-ink" role="status">
          {heardNote || heard}
        </p>
      ) : null}
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
