import { useEffect, useRef, useState, type FormEvent } from "react";
import { createFileRoute, Link, Navigate, useNavigate } from "@tanstack/react-router";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { APP_NAME } from "@/lib/brand";
import { TrialFinished } from "@/components/trial-finished";
import { ConfirmEmailLock } from "@/components/confirm-email";
import { EngineRail, PageSkeleton, Shell } from "@/components/shell";
import { endReasonSentence, formatOnline, IDLE_MS, type EndReason } from "@/lib/academic-email";
import { ENGINE_ACTIVITY_EVENT, engineIsBusy, inactivityDue, markEngineSession, noteEngineActivity } from "@/lib/engine-activity";
import { GRADES, levelLabel, subjectMeta } from "@/lib/climb-rules";
import { stepName } from "@/lib/cc-steps";
import {
  academicReport,
  beginSitting,
  endChildSession,
  getClimb,
  completeAlphabetExercise,
  markPhonemic,
  markSightWord,
  markSpelling,
  placeSpellingExercise,
  recordAnswer,
  revealNextQuestion,
  setChildAge,
  setClimbLevel,
  touchSitting,
  type Climb,
} from "@/lib/climbs";
import { beatStudentClock, readStudentClock, resumeStudentClock } from "@/lib/day-clock";
import { GRADING_PAUSE_MESSAGE, NO_REPLY_MESSAGE } from "@/lib/grading-pause";
import { showAsSpaceXsi } from "@/lib/space-xsi";
import { VKOLE_MOVEMENT } from "@/lib/vkole-cap";
import { SIGHT_WORD_NOTE } from "@/lib/vkole/constants";
import { SPELLING_NOTE } from "@/lib/vkole/spelling/items";
import { SPELLING_REPORT_LABEL } from "@/lib/vkole/spelling/report";
import { PA_NOTE } from "@/lib/vkole/phonemic-awareness/items";
import { PhonemicStage } from "@/components/phonemic-stage";
import { SightWordStage } from "@/components/sight-word-stage";
import { SpellingStage } from "@/components/spelling-stage";
import { SG_STAGE_NOTE, sgCodeLabel, singaporePlace } from "@/lib/vkole-singapore";
import { SgFigure, splitFigures } from "@/components/sg-figure";
import { deviceTimeZone } from "@/lib/day-clock-math";
import type { ClockFace } from "@/components/vkole-rules";
import { SchoolPath } from "@/components/school-path";
import { WebsiteVisit } from "@/components/website-visit";

export const Route = createFileRoute("/session/$id")({ component: SessionPage });

type Closure = {
  reason: EndReason;
  recipient: string;
  sent: boolean;
  error: string;
  subject: string;
  body: string;
  sittingSeconds: number;
  totalSeconds: number;
  sheetNote: string;
  spellingReport: string;
};

let pendingLeave: { id: string; cancel: () => void } | null = null;

function Feedback({ text }: { text: string }) {
  const shown = showAsSpaceXsi(text);
  const matched = shown.match(/^Answer:\s*([\s\S]+?)\n+\s*Explanation:\s*([\s\S]+)$/i) ?? shown.match(/^Answer:\s*(.+?)\s+Explanation:\s*(.+)$/i);
  if (!matched) return <p className="mt-4 whitespace-pre-wrap text-ink">{shown}</p>;
  return (
    <div className="mt-4">
      <p className="text-xs tracking-wide text-muted uppercase">Answer</p>
      <p className="mt-1 text-ink">{matched[1]?.trim()}</p>
      <p className="mt-3 text-xs tracking-wide text-muted uppercase">Explanation</p>
      <p className="mt-1 whitespace-pre-wrap text-ink">{matched[2]?.trim()}</p>
    </div>
  );
}

function Reading({ prompt }: { prompt: string }) {
  const shown = showAsSpaceXsi(prompt);
  const matched = shown.match(/^Read:\s*([\s\S]+?)\n+\s*Question:\s*([\s\S]+)$/i);
  if (matched) {
    return (
      <>
        <p className="mt-4 text-xs tracking-wide text-muted uppercase">Read</p>
        <p className="mt-2 whitespace-pre-wrap text-base leading-relaxed text-ink">{matched[1]?.trim()}</p>
        <h2 className="mt-4 font-display text-2xl leading-snug text-ink">{matched[2]?.trim()}</h2>
      </>
    );
  }
  const drawn = splitFigures(shown);
  return (
    <>
      {drawn.figures.map((line) => (
        <SgFigure key={line} line={line} />
      ))}
      <h2 className="mt-2 whitespace-pre-wrap font-display text-2xl leading-snug text-ink">{drawn.text || shown}</h2>
    </>
  );
}

function SessionPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { user, isPending } = useCurrentUserState();
  const [climb, setClimb] = useState<Climb | null>(null);
  const [missing, setMissing] = useState(false);
  const [answer, setAnswer] = useState("");
  const [pendingAnswer, setPendingAnswer] = useState(false);
  const [error, setError] = useState("");
  const [pause, setPause] = useState("");
  const [ageInput, setAgeInput] = useState(8);
  const [report, setReport] = useState("");
  const [onlineAt, setOnlineAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [closure, setClosure] = useState<Closure | null>(null);
  const [clock, setClock] = useState<ClockFace | null>(null);
  const [levelPassword, setLevelPassword] = useState("");
  const [studentPassword, setStudentPassword] = useState("");
  const [sightRound, setSightRound] = useState(0);
  const [spellingRound, setSpellingRound] = useState(0);
  const [spellingHeard, setSpellingHeard] = useState("");
  const [paRound, setPaRound] = useState(0);
  const finishRef = useRef<(reason: EndReason, explicitLogout?: boolean) => void>(() => {});

  const userId = user?.id;
  const clockOpen = Boolean(clock?.armed && !clock.closed);
  const climbId = climb && !climb.blocked && clockOpen ? climb.id : undefined;

  useEffect(() => {
    if (!userId) return;
    let live = true;
    getClimb({ data: { id } })
      .then((row) => {
        if (!live) return;
        setClimb(row);
      })
      .catch(() => {
        if (live) setMissing(true);
      });
    return () => {
      live = false;
    };
  }, [id, userId]);

  useEffect(() => {
    if (!climb || climb.blocked || climb.fullAccess) return;
    const deadline = climb.subscribed ? climb.subscriptionEndsAt : climb.endsAt;
    if (!deadline) return;
    const ms = new Date(deadline).getTime() - Date.now();
    const stop = () => {
      setClimb((row) => (row ? { ...row, expired: true, blocked: true, daysLeft: 0, subscribed: false } : row));
    };
    if (ms <= 0) {
      stop();
      return;
    }
    const id = window.setTimeout(stop, ms);
    return () => window.clearTimeout(id);
  }, [climb?.id, climb?.endsAt, climb?.subscriptionEndsAt, climb?.subscribed, climb?.renews, climb?.blocked, climb?.fullAccess]);

  useEffect(() => {
    if (!userId || !climb || climb.blocked) return;
    let live = true;
    readStudentClock({ data: { id: climb.id, timeZone: deviceTimeZone() } })
      .then((row) => {
        if (live) setClock(row);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [userId, climb?.id, climb?.blocked]);

  useEffect(() => {
    if (!climb?.age) return;
    let live = true;
    academicReport({ data: { id: climb.id } })
      .then((letter) => {
        if (live) setReport(`${letter.subject}\n\n${letter.body}`);
      })
      .catch(() => {
        if (live) setReport("");
      });
    return () => {
      live = false;
    };
  }, [climb?.id, climb?.age, climb?.level, climb?.asked, climb?.rightCount]);

  useEffect(() => {
    if (!onlineAt || closure) return;
    const tick = () => setElapsed(Math.max(0, Date.now() - onlineAt));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [onlineAt, closure]);

  useEffect(() => {
    markEngineSession(true);
    return () => {
      markEngineSession(false);
    };
  }, []);

  useEffect(() => {
    const leaving = pendingLeave;
    if (leaving && leaving.id === climbId) {
      leaving.cancel();
      pendingLeave = null;
    }
    if (!userId || !climbId) return;
    let stopped = false;
    const closing = { current: false };
    let last = Date.now();
    let lastSent = 0;
    let opened = Promise.resolve();

    const finish = (reason: EndReason, explicitLogout = false) => {
      if (closing.current) return;
      closing.current = true;
      try {
        sessionStorage.setItem("vkole-last-mail", JSON.stringify({ pending: true, reason }));
      } catch {
        /* storage may be unavailable */
      }
      void opened
        .catch(() => undefined)
        .then(() => endChildSession({ data: { id: climbId, reason, explicitLogout } }))
        .then((result) => {
          const leaveThisEngine = reason !== "inactivity";
          if (!result || (result.alreadyClosed && !result.body && !result.spellingReport)) {
            if (!stopped && leaveThisEngine) void navigate({ to: "/" });
            return;
          }
          const note: Closure = {
            reason: result.reason,
            recipient: result.recipient,
            sent: result.sent,
            error: result.error,
            subject: result.subject,
            body: result.body,
            sittingSeconds: result.sittingSeconds,
            totalSeconds: result.totalSeconds,
            sheetNote: result.sheetNote,
            spellingReport: result.spellingReport,
          };
          try {
            if (leaveThisEngine || stopped) sessionStorage.setItem("vkole-last-mail", JSON.stringify(note));
            else sessionStorage.removeItem("vkole-last-mail");
          } catch {
            /* storage may be unavailable */
          }
          if (stopped) return;
          if (leaveThisEngine) void navigate({ to: "/" });
          else setClosure(note);
        })
        .catch(() => {
          closing.current = false;
        });
    };
    finishRef.current = finish;

    const stamp = () => {
      last = Date.now();
    };
    const mark = () => {
      stamp();
      noteEngineActivity(last);
    };
    const onEngine = () => {
      stamp();
    };
    opened = beginSitting({ data: { id: climbId } })
      .then((row) => {
        if (!stopped) setOnlineAt(new Date(row.startedAt).getTime());
      })
      .catch((err: unknown) => {
        if (!stopped) setError(err instanceof Error ? err.message : "Could not start this sitting.");
        throw err;
      });

    const names = ["pointerdown", "keydown", "touchstart"] as const;
    for (const name of names) window.addEventListener(name, mark, { passive: true });
    window.addEventListener(ENGINE_ACTIVITY_EVENT, onEngine);
    const poll = window.setInterval(() => {
      if (inactivityDue(last, Date.now(), engineIsBusy(), IDLE_MS)) finish("inactivity");
    }, 5000);
    const beat = window.setInterval(() => {
      if (engineIsBusy()) stamp();
      if (last > lastSent && !inactivityDue(last, Date.now(), false, IDLE_MS)) {
        lastSent = last;
        void touchSitting({ data: { id: climbId } }).catch(() => undefined);
        void beatStudentClock({ data: { id: climbId, timeZone: deviceTimeZone() } })
          .then((next) => {
            if (stopped) return;
            if (next.closed) {
              setClock(next);
              finish("logout");
              return;
            }
            if (!next.armed && engineIsBusy()) return;
            setClock(next);
            if (!next.armed) finish("inactivity");
          })
          .catch(() => undefined);
      }
    }, 5000);
    const onVisible = () => {
      if (document.visibilityState === "hidden") {
        void touchSitting({ data: { id: climbId } }).catch(() => undefined);
        return;
      }
      if (inactivityDue(last, Date.now(), engineIsBusy(), IDLE_MS)) finish("inactivity");
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      stopped = true;
      window.clearInterval(poll);
      window.clearInterval(beat);
      for (const name of names) window.removeEventListener(name, mark);
      window.removeEventListener(ENGINE_ACTIVITY_EVENT, onEngine);
      document.removeEventListener("visibilitychange", onVisible);
      if (closing.current) return;
      const timer = window.setTimeout(() => finish("logout"), 500);
      pendingLeave = { id: climbId, cancel: () => window.clearTimeout(timer) };
    };
  }, [userId, climbId, navigate]);

  if (isPending) return <PageSkeleton />;
  if (!user) return <Navigate to="/login" />;
  if (missing) {
    return (
      <Shell>
        <h1 className="font-display text-3xl">Session not found</h1>
        <Link to="/" className="mt-4 inline-flex min-h-11 items-center text-accent">
          Back to sessions
        </Link>
      </Shell>
    );
  }
  if (!climb) return <PageSkeleton />;
  if (climb.confirmEmail) return <ConfirmEmailLock />;
  if (climb.blocked) {
    return (
      <TrialFinished
        subject={climb.subject}
        wholeApp
        reason={climb.plan === "month" || climb.plan === "year" ? climb.plan : "trial"}
        stopped={climb.plan === "month" || climb.plan === "year" ? (climb.renews ? "unpaid" : "cancelled") : undefined}
        onSplash={() => {
          try {
            sessionStorage.setItem("vkole-unpaid", "1");
            sessionStorage.setItem("vkole-tour", "1");
          } catch {
            /* storage may be unavailable */
          }
          window.location.assign("/");
        }}
      />
    );
  }

  const meta = subjectMeta(climb.subject);

  async function submitAnswer(event: FormEvent) {
    event.preventDefault();
    noteEngineActivity();
    if (!climb || pendingAnswer || climb.awaitingNext) return;
    const given = answer.trim();
    if (!given) return;
    setPendingAnswer(true);
    setError("");
    setPause("");
    try {
      const result = await recordAnswer({ data: { id: climb.id, answer: given } });
      setClimb(result.climb);
      if (result.status === "again") setError(NO_REPLY_MESSAGE);
      else if (result.status === "rest") setPause(GRADING_PAUSE_MESSAGE);
      else setAnswer("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Please try again.");
    } finally {
      setPendingAnswer(false);
    }
  }

  async function revealNext() {
    noteEngineActivity();
    if (!climb) return;
    setError("");
    try {
      setClimb(await revealNextQuestion({ data: { id: climb.id } }));
      setAnswer("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Please try again.");
    }
  }

  async function stepLevel(direction: "up" | "down") {
    if (!climb) return;
    if (levelPassword.length < 8) {
      setError("Enter the password of the account that registered.");
      return;
    }
    setError("");
    try {
      const row = await setClimbLevel({ data: { id: climb.id, direction, password: levelPassword } });
      setClimb(row);
      setAnswer("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not set the level.");
    }
  }

  async function saveAge(event: FormEvent) {
    event.preventDefault();
    if (!climb) return;
    setError("");
    try {
      const row = await setChildAge({ data: { id: climb.id, age: ageInput } });
      setClimb(row);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the age.");
    }
  }

  return (
    <Shell>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold tracking-wide text-accent uppercase">VKOLE/{meta.code}</p>
          <h1 className="font-display text-3xl text-ink">{climb.childName}</h1>
          <p className="text-sm text-muted">{APP_NAME}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {closure ? null : (
            <button
              type="button"
              onClick={() => finishRef.current("logout", true)}
              className="inline-flex min-h-11 items-center rounded-xl border border-line bg-surface px-4 text-sm text-ink"
            >
              Log out
            </button>
          )}
          <Link to="/" className="inline-flex min-h-11 items-center px-3 text-sm text-muted">
            All sessions
          </Link>
        </div>
      </div>
      <EngineRail current={climb.subject} />
      <div className="mt-4 flex gap-1" aria-hidden="true">
        {GRADES.map((grade, index) => (
          <span key={grade} className={index <= Math.min(climb.level, 12) ? "h-2 flex-1 rounded-full bg-accent" : "h-2 flex-1 rounded-full bg-line"} />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-sm text-muted">
        <span className="rounded-full border border-line bg-surface px-3 py-1">
          Working level <strong className="font-semibold text-ink">{climb.subject === "sw" || climb.subject === "sp" || climb.subject === "pa" ? `${levelLabel(climb.level)} · ${climb.standardLabel || climb.standardCode}` : climb.subject === "sg" ? `${singaporePlace(climb.level).short} · ${stepName(climb.subject, climb.level, climb.standardStep ?? 0)} · ${(climb.standardStep ?? 0) + 1} of 3` : `${levelLabel(climb.level)} · ${stepName(climb.subject, climb.level, climb.standardStep ?? 0)} · ${(climb.standardStep ?? 0) + 1} of 3`}</strong>
        </span>
        <span className="rounded-full border border-line bg-surface px-3 py-1">
          Earned level <strong className="font-semibold text-ink">{levelLabel(climb.performanceLevel)}</strong>
        </span>
        {climb.subject === "sw" || climb.subject === "sp" || climb.subject === "pa" ? null : (
          <span className="rounded-full border border-line bg-surface px-3 py-1">
            Correct <strong className="font-semibold text-ink">{climb.correctAtLevel}/2</strong>
          </span>
        )}
        {climb.subject === "sw" || climb.subject === "sp" || climb.subject === "pa" ? null : (
          <span className="rounded-full border border-line bg-surface px-3 py-1">
            Miss streak <strong className="font-semibold text-ink">{climb.incorrectStreak}/2</strong>
          </span>
        )}
        <span className="rounded-full border border-line bg-surface px-3 py-1">
          Session <strong className="font-semibold text-ink">{climb.rightCount}/{climb.asked}</strong>
        </span>
        {climb.fullAccess || climb.subscribed ? (
          <span className="rounded-full border border-line bg-surface px-3 py-1">
            {climb.fullAccess ? "Access" : "Free period"}{" "}
            <strong className="font-semibold text-ink">
              {climb.fullAccess
                ? "open"
                : `subscribed until ${new Date(climb.subscriptionEndsAt ?? climb.endsAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`}
            </strong>
          </span>
        ) : null}
        {climb.age != null ? (
          <span className="rounded-full border border-line bg-surface px-3 py-1">
            Age <strong className="font-semibold text-ink">{climb.age}</strong>
          </span>
        ) : null}
        {onlineAt && !closure ? (
          <span className="rounded-full border border-line bg-surface px-3 py-1">
            Online <strong className="font-semibold text-ink">{formatOnline(Math.round(elapsed / 1000))}</strong>
          </span>
        ) : null}
      </div>
      <p className="mt-3 text-sm text-muted">{climb.subject === "sw" ? SIGHT_WORD_NOTE : climb.subject === "sp" ? SPELLING_NOTE : climb.subject === "pa" ? PA_NOTE : VKOLE_MOVEMENT}</p>
      {climb.subject === "sg" ? <p className="mt-2 text-sm text-muted">{SG_STAGE_NOTE}</p> : null}
      <SchoolPath />
      {!closure && clock?.closed ? (
        <p className="mt-5 text-ink">The 8 hours for this student are used. The engines open again at midnight Pacific time.</p>
      ) : null}
      {!closure && clock && !clock.armed && !clock.closed ? (
        <form
          className="mt-5 rounded-2xl border border-line bg-surface p-5"
          onSubmit={(event) => {
            event.preventDefault();
            setError("");
            void resumeStudentClock({ data: { id: climb.id, password: studentPassword, timeZone: deviceTimeZone() } })
              .then((next) => {
                setClock(next);
                setStudentPassword("");
              })
              .catch((err: unknown) => {
                setError(err instanceof Error ? err.message : "Could not continue.");
              });
          }}
        >
          <p className="text-ink">
            {clock.passwordSet
              ? `Enter the student password to continue as ${clock.childName}. Time already used today stays on this login.`
              : `Choose an easy password for ${clock.childName}. It is required the next time the clock stops.`}
          </p>
          <label className="mt-3 block text-sm text-muted">
            Student password
            <input
              type="password"
              value={studentPassword}
              onChange={(event) => setStudentPassword(event.target.value)}
              autoComplete="current-password"
              className="mt-1 w-full rounded-xl border border-line bg-bg px-3 py-2 text-ink"
            />
          </label>
          {error ? <p className="mt-3 text-sm text-miss">{error}</p> : null}
          <button type="submit" className="mt-4 min-h-11 rounded-xl bg-accent px-5 font-semibold text-accent-ink">
            Continue
          </button>
        </form>
      ) : null}
      {closure ? (
        <section className="mt-5 rounded-2xl border border-line bg-surface p-5">
          <h2 className="font-display text-2xl text-ink">Session closed</h2>
          <p className="mt-2 text-ink">{endReasonSentence(closure.reason)}</p>
          <p className="mt-2 text-ink">Time online this sitting: {formatOnline(closure.sittingSeconds)}.</p>
          <p className="text-ink">Total time online in this program: {formatOnline(closure.totalSeconds)}.</p>
          <p className="mt-2 text-sm text-muted">
            {closure.sent
              ? `Academic email sent to ${closure.recipient}.`
              : closure.error || "The academic email was not sent."}
          </p>
          {closure.sheetNote ? <p className="mt-2 text-sm text-miss">{closure.sheetNote}</p> : null}
          {closure.spellingReport ? (
            <div className="mt-4 rounded-xl border border-line bg-paper p-4">
              <h3 className="font-display text-xl text-ink">{SPELLING_REPORT_LABEL}</h3>
              <p className="mt-2 text-ink">{closure.spellingReport}</p>
            </div>
          ) : null}
          {closure.body ? (
            <pre className="mt-4 whitespace-pre-wrap font-sans text-sm leading-relaxed text-ink">{`${closure.subject}\n\n${closure.body}`}</pre>
          ) : null}
          <Link
            to="/"
            className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-ink bg-paper px-5 text-base font-semibold text-ink"
          >
            Other engines
          </Link>
          {closure.reason === "finished" ? <WebsiteVisit /> : null}
        </section>
      ) : !clockOpen ? null : climb.age == null ? (
        <form onSubmit={saveAge} className="mt-5 rounded-2xl border border-line bg-surface p-5">
          <p className="text-ink">Age is required for the academic record. The saved level stays {levelLabel(climb.level)}.</p>
          <label className="mt-3 block text-sm text-muted">
            Age
            <input
              type="number"
              min={4}
              max={18}
              value={ageInput}
              onChange={(event) => setAgeInput(Number(event.target.value))}
              className="mt-1 min-h-11 w-full rounded-xl border border-line bg-paper px-3 text-base text-ink"
            />
          </label>
          <button type="submit" className="mt-4 min-h-11 rounded-xl bg-accent px-5 font-semibold text-accent-ink">
            Save age
          </button>
        </form>
      ) : (
      <article className="mt-5 rounded-2xl border border-line bg-surface p-5">
        {climb.subject === "sw" ? (
          <SightWordStage
            key={`${climb.currentPrompt}:${sightRound}`}
            word={climb.currentPrompt}
            band={climb.standardCode}
            index={climb.standardStep}
            onDone={(outcome) => {
              noteEngineActivity();
              if (pendingAnswer) return;
              setPendingAnswer(true);
              setError("");
              void markSightWord({ data: { id: climb.id, outcome } })
                .then((row) => setClimb(row))
                .catch((err: unknown) => {
                  setError(err instanceof Error ? err.message : "Could not save that word.");
                  setSightRound((round) => round + 1);
                })
                .finally(() => setPendingAnswer(false));
            }}
          />
        ) : climb.subject === "sp" ? (
          <SpellingStage
            key={`${climb.id}:${spellingRound}`}
            index={climb.standardStep}
            silence={climb.correctAtLevel}
            wrong={climb.incorrectStreak}
            heard={spellingHeard}
            onHeard={setSpellingHeard}
            onRecited={() => {
              noteEngineActivity();
              void placeSpellingExercise({ data: { id: climb.id, exercise: 5 } })
                .then(() => markSpelling({ data: { id: climb.id, outcome: "correct" } }))
                .then((row) => setClimb(row))
                .catch((err: unknown) => {
                  setError(err instanceof Error ? err.message : "Could not save that answer.");
                });
            }}
            onDone={(outcome) => {
              noteEngineActivity();
              if (pendingAnswer) return;
              if (outcome !== "correct") return;
              setPendingAnswer(true);
              setError("");
              void completeAlphabetExercise({ data: { id: climb.id, exercise: 6 } })
                .then((row) => {
                  setClimb(row);
                  finishRef.current("finished");
                })
                .catch((err: unknown) => {
                  setError(err instanceof Error ? err.message : "Could not save that answer.");
                  setSpellingRound((round) => round + 1);
                })
                .finally(() => setPendingAnswer(false));
            }}
          />
        ) : climb.subject === "pa" ? (
          <PhonemicStage
            key={`${climb.standardCode}:${climb.standardStep}:${paRound}`}
            band={climb.standardCode}
            index={climb.standardStep}
            onDone={(outcome) => {
              noteEngineActivity();
              if (pendingAnswer) return;
              setPendingAnswer(true);
              setError("");
              void markPhonemic({ data: { id: climb.id, outcome } })
                .then((row) => setClimb(row))
                .catch((err: unknown) => {
                  setError(err instanceof Error ? err.message : "Could not save that prompt.");
                  setPaRound((round) => round + 1);
                })
                .finally(() => setPendingAnswer(false));
            }}
          />
        ) : (
        <>
        <p className="text-xs tracking-wide text-muted uppercase">{climb.subject === "sg" ? sgCodeLabel(climb.standardCode) : climb.standardCode}</p>
        <Reading prompt={climb.currentPrompt} />
        {climb.awaitingNext ? (
          <>
            <Feedback text={climb.lastFeedback} />
            <button
              type="button"
              onClick={() => void revealNext()}
              className="mt-4 min-h-11 rounded-xl bg-accent px-5 font-semibold text-accent-ink"
            >
              Next question
            </button>
          </>
        ) : pause ? (
          <p className="mt-4 text-ink">{pause}</p>
        ) : (
          <form onSubmit={submitAnswer} className="mt-4">
            <label className="block text-sm text-muted">
              Answer
              <input
                value={answer}
                onChange={(event) => setAnswer(event.target.value)}
                className="mt-1 min-h-11 w-full rounded-xl border border-line bg-paper px-3 text-base text-ink"
              />
            </label>
            <button
              type="submit"
              disabled={pendingAnswer || answer.trim().length === 0}
              className="mt-4 min-h-11 rounded-xl bg-accent px-5 font-semibold text-accent-ink disabled:opacity-40"
            >
              {pendingAnswer ? "Checking…" : "Submit"}
            </button>
          </form>
        )}
        {error ? <p className="mt-3 text-sm text-miss">{error}</p> : null}
        </>
        )}
        {(climb.subject === "sw" || climb.subject === "sp" || climb.subject === "pa") && error ? <p className="mt-3 text-sm text-miss">{error}</p> : null}
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => finishRef.current("finished")}
            className="min-h-12 flex-1 rounded-xl border border-ink bg-paper px-5 text-base font-semibold text-ink"
          >
            Finished
          </button>
          <Link
            to="/"
            className="inline-flex min-h-12 flex-1 items-center justify-center rounded-xl border border-ink bg-paper px-5 text-base font-semibold text-ink"
          >
            Other engines
          </Link>
        </div>
      </article>
      )}
      {!closure && climb.age != null ? (
        <div className="mt-6 space-y-2">
          <label className="block text-sm text-muted">
            Account password
            <input
              type="password"
              value={levelPassword}
              onChange={(event) => setLevelPassword(event.target.value)}
              autoComplete="current-password"
              className="mt-1 min-h-11 w-full rounded-xl border border-line bg-paper px-3 text-base text-ink"
            />
          </label>
          <p className="text-sm text-muted">Only the person who registered this account can change the working level.</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void stepLevel("down")} className="min-h-11 rounded-xl border border-line bg-surface px-4 text-sm text-ink">
              Lower the working level. The earned level stays.
            </button>
            <button type="button" onClick={() => void stepLevel("up")} className="min-h-11 rounded-xl border border-line bg-surface px-4 text-sm text-ink">
              Raise the working level. The earned level stays.
            </button>
          </div>
        </div>
      ) : null}
      {error && climb.age == null && !closure ? <p className="mt-3 text-sm text-miss">{error}</p> : null}
      {!closure && report ? (
        <section className="mt-6 rounded-2xl border border-line bg-surface p-5">
          <h2 className="font-display text-2xl text-ink">Academic email</h2>
          <p className="mt-1 text-sm text-muted">
            Sent to the email the parent gave at registration when the child presses Finished or Log out on this engine, or after 5 minutes with no activity. The other engines stay open. It includes time online and how the session ended.
          </p>
          <pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-relaxed text-ink">{report}</pre>
        </section>
      ) : null}
    </Shell>
  );
}
