import { useEffect, useRef, useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { ParentLogin } from "@/components/parent-login";
import { SchoolSplash } from "@/components/school-splash";
import { TeletypeIntro } from "@/components/teletype-intro";
import { TrialFinished, type EndedReason, type StoppedBecause } from "@/components/trial-finished";
import { SchoolAccountScreen } from "@/components/school-account-screen";
import { StudentOffice } from "@/components/student-office";
import { schoolScreen, SCHOOL_ENGINE_URL } from "@/lib/school-account";
import { EnginePicks, PageSkeleton, Shell } from "@/components/shell";
import { SchoolPath } from "@/components/school-path";
import { SUBJECTS, levelLabel, subjectMeta, type SubjectId } from "@/lib/climb-rules";
import { singaporePlace } from "@/lib/vkole-singapore";
import { stepName } from "@/lib/cc-steps";
import { beginSharedTrial, listClimbs, setClimbLevel, type Climb } from "@/lib/climbs";
import { enterEngine } from "@/lib/day-clock";
import { deviceTimeZone } from "@/lib/day-clock-math";
import { allowGmail, noteAccount } from "@/lib/ledger";
import { useRefetchWhenConnectorReady } from "@/lib/app-data/use-connector-readiness";
import { endReasonSentence, type EndReason } from "@/lib/academic-email";
import { ACCOUNT_GONE_FLAG } from "@/lib/account-purge";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const navigate = useNavigate();
  const { user, isPending } = useCurrentUserState();
  const [stage, setStage] = useState<"splash" | "teletype" | "app" | "trial">("splash");
  const [createAccount, setCreateAccount] = useState(false);
  const [accountGone, setAccountGone] = useState(false);
  const [unpaid, setUnpaid] = useState(false);
  const [gate, setGate] = useState<"unknown" | "open" | "closed">("unknown");
  const [endsAt, setEndsAt] = useState<string | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [fullAccess, setFullAccess] = useState(false);
  const [endedPlan, setEndedPlan] = useState<EndedReason>("trial");
  const [stopped, setStopped] = useState<StoppedBecause | undefined>(undefined);
  const touring = useRef(false);
  const stageRef = useRef(stage);
  stageRef.current = stage;

  useEffect(() => {
    try {
      if (sessionStorage.getItem(ACCOUNT_GONE_FLAG) === "1") setAccountGone(true);
    } catch {
      /* storage may be unavailable */
    }
    try {
      if (sessionStorage.getItem("vkole-tour") === "1") {
        sessionStorage.removeItem("vkole-tour");
        touring.current = true;
        setStage("splash");
      }
    } catch {
      /* storage may be unavailable */
    }
    const engineId = window.location.hash.replace(/^#engine-/, "");
    if (SUBJECTS.some((subject) => subject.id === engineId)) setStage("app");
    const params = new URLSearchParams(window.location.search);
    if (params.get("open") === "1") {
      params.delete("open");
      const next = params.toString();
      window.history.replaceState(null, "", next ? `/?${next}` : "/");
      setUnpaid(false);
      setGate("open");
      try {
        sessionStorage.removeItem("vkole-unpaid");
      } catch {
        /* storage may be unavailable */
      }
      setStage("app");
    }
    if (params.get("new") !== "1") return;
    params.delete("new");
    const next = params.toString();
    window.history.replaceState(null, "", next ? `/?${next}` : "/");
    setCreateAccount(true);
    touring.current = true;
    setStage("app");
  }, []);

  useEffect(() => {
    if (stage !== "app") return;
    const engineId = window.location.hash.replace(/^#engine-/, "");
    if (!SUBJECTS.some((subject) => subject.id === engineId)) return;
    document.getElementById(`engine-${engineId}`)?.scrollIntoView({ block: "start" });
  }, [stage, user]);

  useEffect(() => {
    if (isPending || !user || accountGone) return;
    let live = true;
    listClimbs()
      .then((result) => {
        if (!live) return;
        setEndsAt(result.fullAccess ? null : result.endsAt);
        setSubscribed(result.subscribed);
        setFullAccess(result.fullAccess);
        if (result.plan === "month" || result.plan === "year") {
          setEndedPlan(result.plan);
          setStopped(result.renews ? "unpaid" : "cancelled");
        }
        if (result.fullAccess) {
          setGate("open");
          setUnpaid(false);
          try {
            sessionStorage.removeItem("vkole-unpaid");
          } catch {
            /* storage may be unavailable */
          }
          return;
        }
        if (result.blocked) {
          setGate("closed");
          setUnpaid(true);
          try {
            sessionStorage.setItem("vkole-unpaid", "1");
          } catch {
            /* storage may be unavailable */
          }
          if (stageRef.current === "app") setStage("trial");
          return;
        }
        setGate("open");
        setUnpaid(false);
        try {
          sessionStorage.removeItem("vkole-unpaid");
        } catch {
          /* storage may be unavailable */
        }
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [user, isPending, accountGone]);

  useEffect(() => {
    if (!endsAt || gate === "closed" || fullAccess || subscribed) return;
    const ms = new Date(endsAt).getTime() - Date.now();
    const close = () => {
      setGate("closed");
      setUnpaid(true);
      try {
        sessionStorage.setItem("vkole-unpaid", "1");
      } catch {
        /* storage may be unavailable */
      }
      setStage((current) => (current === "splash" || current === "teletype" ? current : "trial"));
    };
    if (ms <= 0) {
      if (gate === "open") close();
      return;
    }
    const id = window.setTimeout(close, ms);
    return () => window.clearTimeout(id);
  }, [endsAt, gate, fullAccess, subscribed]);

  const trialClosed = () => {
    if (gate === "closed") return true;
    if (gate === "open") return false;
    try {
      return sessionStorage.getItem("vkole-unpaid") === "1";
    } catch {
      return false;
    }
  };

  if (isPending && !createAccount && !accountGone) return <PageSkeleton />;
  if (stage === "splash") {
    return (
      <SchoolSplash onEnter={() => setStage(trialClosed() ? "trial" : "teletype")} />
    );
  }
  if (stage === "teletype") {
    return (
      <TeletypeIntro
        onSplash={() => {
          touring.current = false;
          setStage(unpaid ? "trial" : "splash");
        }}
        onContinue={() => {
          touring.current = false;
          setStage(unpaid ? "trial" : "app");
        }}
      />
    );
  }
  if (stage === "trial") {
    return (
      <TrialFinished
        subject="m"
        wholeApp
        reason={endedPlan}
        stopped={endedPlan === "trial" ? undefined : stopped}
        onSplash={() => {
          touring.current = true;
          setStage("splash");
        }}
      />
    );
  }
  if (!user || createAccount || accountGone) {
    return (
      <ParentLogin
        onSplash={() => {
          setCreateAccount(false);
          setAccountGone(false);
          setStage("splash");
        }}
        initialMode={createAccount ? "up" : "in"}
        onAccountReady={() => {
          setCreateAccount(false);
          setAccountGone(false);
          try {
            sessionStorage.removeItem(ACCOUNT_GONE_FLAG);
          } catch {
            /* storage may be unavailable */
          }
        }}
      />
    );
  }
  return (
    <StartSession
      onSplash={() => setStage("splash")}
      onTrialSplash={() => {
        touring.current = true;
        setUnpaid(true);
        setStage("splash");
      }}
    />
  );
}

function StartSession({ onSplash, onTrialSplash }: { onSplash: () => void; onTrialSplash: () => void }) {
  const [climbs, setClimbs] = useState<Climb[] | null>(null);
  const [daysLeft, setDaysLeft] = useState<number | null>(null);
  const [fullAccess, setFullAccess] = useState(false);
  const [trialOver, setTrialOver] = useState(false);
  const [endedPlan, setEndedPlan] = useState<EndedReason>("trial");
  const [stopped, setStopped] = useState<StoppedBecause | undefined>(undefined);
  const [sub, setSub] = useState<{ subscribed: boolean; renews: boolean; endsAt: string; plan: "month" | "year" } | null>(null);
  const [office, setOffice] = useState<{ purchased: boolean; slug: string | null } | null>(null);
  const [revision, setRevision] = useState(0);
  const [account, setAccount] = useState<{
    email: string;
    loginCount: number;
    paymentCount: number;
    notice?: { sent: boolean; error: string; pending?: boolean };
    mailAllowed?: boolean;
    mailDesk?: boolean;
  } | null>(null);
  const [mailNote, setMailNote] = useState("");
  const [appPassword, setAppPassword] = useState("");
  const [allowNote, setAllowNote] = useState("");
  const [allowing, setAllowing] = useState(false);
  const [closedApp, setClosedApp] = useState<SubjectId | null>(null);
  const [loadError, setLoadError] = useState("");
  useRefetchWhenConnectorReady(Boolean(account?.notice?.pending), () => {
    void noteAccount()
      .then((result) => setAccount(result))
      .catch(() => undefined);
  });

  useEffect(() => {
    let live = true;
    const read = () => {
      const raw = sessionStorage.getItem("vkole-last-mail");
      if (!raw) return false;
      try {
        const note = JSON.parse(raw) as {
          pending?: boolean;
          reason?: string;
          sent?: boolean;
          recipient?: string;
          error?: string;
          body?: string;
        };
        if (note.pending || !note.body) return false;
        sessionStorage.removeItem("vkole-last-mail");
        if (!live) return true;
        const reason: EndReason = note.reason === "inactivity" || note.reason === "finished" ? note.reason : "logout";
        const how = endReasonSentence(reason);
        setMailNote(
          note.sent
            ? `${how} Academic email sent to ${note.recipient}.`
            : `${how} ${note.error || "The academic email could not be sent."}`,
        );
        return true;
      } catch {
        return false;
      }
    };
    if (read()) return;
    const timer = window.setInterval(() => {
      if (read()) window.clearInterval(timer);
    }, 400);
    const stop = window.setTimeout(() => window.clearInterval(timer), 8000);
    return () => {
      live = false;
      window.clearInterval(timer);
      window.clearTimeout(stop);
    };
  }, []);

  useEffect(() => {
    let live = true;
    listClimbs()
      .then((result) => {
        if (!live) return;
        setClimbs(result.climbs);
        setDaysLeft(result.fullAccess ? null : result.daysLeft);
        setFullAccess(result.fullAccess);
        setTrialOver(result.fullAccess ? false : result.blocked);
        if (result.plan === "month" || result.plan === "year") {
          setEndedPlan(result.plan);
          setStopped(result.renews ? "unpaid" : "cancelled");
        }
        if (result.subscribed && (result.plan === "month" || result.plan === "year")) {
          setSub({ subscribed: true, renews: result.renews, endsAt: result.endsAt ?? "", plan: result.plan });
        } else {
          setSub(null);
        }
        setOffice({ purchased: result.officePurchased === true, slug: result.officeSlug ?? null });
      })
      .catch((err: unknown) => {
        if (!live) return;
        setClimbs([]);
        setLoadError(err instanceof Error ? err.message : "The climbs could not be loaded. Refresh the page.");
      });
    return () => {
      live = false;
    };
  }, [revision]);

  useEffect(() => {
    let live = true;
    noteAccount()
      .then((result) => {
        if (live) setAccount(result);
      })
      .catch(() => undefined);
    if (sessionStorage.getItem("vkole-sync-trial")) {
      sessionStorage.removeItem("vkole-sync-trial");
      void beginSharedTrial().catch(() => undefined);
    }
    return () => {
      live = false;
    };
  }, []);

  if (closedApp || trialOver) {
    return (
      <TrialFinished
        subject={closedApp ?? "m"}
        wholeApp
        reason={endedPlan}
        stopped={endedPlan === "trial" ? undefined : stopped}
        onSplash={onTrialSplash}
        office={office}
      />
    );
  }

  if (loadError && schoolScreen(loadError)) {
    return (
      <SchoolAccountScreen
        message={loadError}
        onRetry={() => {
          setLoadError("");
          setRevision((value) => value + 1);
        }}
      />
    );
  }

  return (
    <Shell onSplash={onSplash}>
      <p className="text-sm font-semibold tracking-wide text-accent uppercase">Parent</p>
      <h1 className="mt-1 font-display text-4xl text-ink">Seven climbs</h1>
      <p className="mt-3 text-muted">
        {fullAccess
          ? "This account is open. It is not on a free week and it is not asked to pay. Each student uses all seven engines. The engines share one clock of 2.5 hours for this login. It resets at midnight Pacific time. Five minutes with no pointer or key stops the clock, and the student password continues it. Time already used stays. Leaving one engine does not stop that clock. After the parent signs in, the student opens each engine with a first name. A name already on file continues at the saved level. When the student presses Finished or Log out on one engine, that engine’s record is emailed once to the address given at registration, and the other engines stay open."
          : "The first sign-in starts a 7 day free trial for this registration. No credit card is required for those seven days. Only the email registration. Each student downloads the app and registers on that student’s own device. One registration is one student, and that student may use all seven engines. The engines share one clock of 2.5 hours for this login. It resets at midnight Pacific time. Five minutes with no pointer or key stops the clock, and the student password continues it. Time already used stays. Leaving one engine does not stop that clock. After the parent signs in, the student opens each engine with a first name. A name already on file continues at the saved level. After the trial, the payment covers that student for a full month or a full year from the day of payment. When the student presses Finished or Log out on one engine, that engine’s record is emailed once to the address given at registration, and the other engines stay open."}
      </p>
      {account ? (
        <p className="mt-3 text-sm text-ink">
          This email is saved: {account.email}. Logins recorded: {account.loginCount}. Reports go only to this address.
        </p>
      ) : null}
      {office && (office.purchased || !fullAccess) ? (
        <StudentOffice purchased={office.purchased} slug={office.slug} />
      ) : null}
      {account?.notice?.error ? <p className="mt-3 text-sm text-miss">{account.notice.error}</p> : null}
      {account?.mailDesk ? (
        <form
          className="mt-4 rounded-2xl border border-line bg-surface p-4 text-sm text-ink"
          onSubmit={(event) => {
            event.preventDefault();
            setAllowing(true);
            setAllowNote("");
            void allowGmail({ data: { password: appPassword } })
              .then((result) => {
                setAccount(result);
                setAppPassword("");
                setAllowNote("Gmail is allowed. A test message was sent to this account only.");
              })
              .catch((err: unknown) => {
                setAllowNote(err instanceof Error ? err.message : "That app password was not accepted.");
              })
              .finally(() => setAllowing(false));
          }}
        >
          <p className="font-semibold">Allow Gmail</p>
          <p className="mt-2 text-muted">
            A student logout cannot carry your Gmail permission. Allow it once for the app. On this Google account, turn on 2-Step Verification, then create an app password named VKOLE/ZPD at myaccount.google.com/apppasswords. Paste it here. This form does not list other families.
          </p>
          {account.mailAllowed ? (
            <p className="mt-2">Gmail is already allowed for this app. Paste a new app password only if you need to replace it.</p>
          ) : null}
          <input
            className="mt-3 min-h-11 w-full rounded-xl border border-line bg-paper px-3 text-base"
            type="password"
            autoComplete="off"
            value={appPassword}
            placeholder="App password"
            onChange={(event) => setAppPassword(event.target.value)}
          />
          <button className="mt-3 inline-flex min-h-11 items-center rounded-full bg-ink px-4 text-paper" type="submit" disabled={allowing || appPassword.trim().length < 8}>
            {allowing ? "Checking…" : "Allow Gmail"}
          </button>
          {allowNote ? <p className="mt-2">{allowNote}</p> : null}
        </form>
      ) : null}
      {sub ? (
        <div className="mt-4 rounded-2xl border border-line bg-surface p-4 text-sm text-ink">
          <p>
            The school account is open
            {sub.plan === "year" ? " on the yearly plan." : sub.plan === "month" ? " on the monthly plan." : "."} Pay
            and cancel on the school website. This app does not charge the card.
          </p>
          <a
            className="mt-3 inline-flex min-h-11 items-center text-accent"
            href={SCHOOL_ENGINE_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open the school engine
          </a>
        </div>
      ) : null}
      {mailNote ? <p className="mt-4 rounded-2xl border border-line bg-surface p-4 text-sm text-ink">{mailNote}</p> : null}
      {loadError ? <p className="mt-4 rounded-2xl border border-line bg-surface p-4 text-sm text-miss">{loadError}</p> : null}
      <SchoolPath className="mt-6" />
      <EnginePicks />
      <div className="mt-3 grid gap-4">
        {SUBJECTS.map((subject) => (
          <AppGate
            key={subject.id}
            subject={subject.id}
            roster={(climbs ?? []).filter((climb) => climb.subject === subject.id)}
            daysLeft={daysLeft}
            trialOver={trialOver}
            fullAccess={fullAccess}
            onTrialFinished={() => setClosedApp(subject.id)}
            onLevelsChanged={() => setRevision((n) => n + 1)}
            onClock={() => setRevision((n) => n + 1)}
          />
        ))}
      </div>
    </Shell>
  );
}

function AppGate({
  subject,
  roster,
  daysLeft,
  trialOver,
  fullAccess = false,
  onTrialFinished,
  onLevelsChanged,
  onClock,
}: {
  subject: SubjectId;
  roster: Climb[];
  daysLeft: number | null;
  trialOver: boolean;
  fullAccess?: boolean;
  onTrialFinished: () => void;
  onLevelsChanged: () => void;
  onClock: () => void;
}) {
  const navigate = useNavigate();
  const meta = subjectMeta(subject);
  const [firstName, setFirstName] = useState("");
  const [shut, setShut] = useState(false);
  const [age, setAge] = useState(8);
  const [gradeText, setGradeText] = useState("");
  const [needsNew, setNeedsNew] = useState(false);
  const [accountPassword, setAccountPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [changing, setChanging] = useState(false);
  const [childId, setChildId] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    const name = firstName.trim().replace(/\s+/g, " ");
    if (!name) {
      setError("Enter the student’s first name.");
      return;
    }
    setError("");
    setShut(false);
    let grade: number | undefined;
    if (needsNew) {
      const typed = Number(gradeText);
      if (!Number.isInteger(typed) || typed < 1 || typed > 12) {
        setError("Enter a starting grade from 1 to 12.");
        return;
      }
      grade = typed;
    }
    setPending(true);
    try {
      const found = await enterEngine({
        data: {
          subject,
          firstName: name,
          age: needsNew ? age : undefined,
          grade: needsNew ? grade : undefined,
          timeZone: deviceTimeZone(),
        },
      });
      if (found.status === "blocked") {
        onTrialFinished();
        return;
      }
      if (found.status === "new") {
        setNeedsNew(true);
        setPending(false);
        return;
      }
      if (found.status === "extra") {
        setError("This registration is for one student. Download the app on the other student’s device and register there.");
        setPending(false);
        return;
      }
      onClock();
      if (found.status === "closed") {
        setShut(true);
        setPending(false);
        return;
      }
      if (found.status !== "open" && found.status !== "hold") {
        setPending(false);
        return;
      }
      await navigate({ to: "/session/$id", params: { id: found.id } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open this app.");
      setPending(false);
    }
  }

  return (
    <form id={`engine-${subject}`} onSubmit={submit} className="scroll-mt-6 rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-2xl text-ink">VKOLE/{meta.code}</h2>
        <span className="text-sm text-muted">
          {fullAccess ? "Open" : trialOver ? "7 day trial finished" : daysLeft == null ? "7 days free" : daysLeft === 0 ? "7 day trial finished" : `${daysLeft} days left`}
        </span>
      </div>
      <p className="text-sm text-muted">{meta.name}</p>
      <p className="mt-2 text-sm text-ink">{meta.lede}</p>
      <label className="mt-3 block text-sm text-muted">
        Student’s first name
        <input
          value={firstName}
          onChange={(event) => {
            setFirstName(event.target.value);
            setNeedsNew(false);
            setGradeText("");
            setShut(false);
          }}
          autoComplete="off"
          className="mt-1 min-h-11 w-full rounded-xl border border-line bg-paper px-3 text-base text-ink"
        />
      </label>
      {roster.length > 0 ? (
        <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto text-sm text-muted">
          {roster.map((climb) => (
            <li key={climb.id}>
              {climb.childName} · working {climb.subject === "sw" || climb.subject === "pa" ? `${levelLabel(climb.level)}, ${climb.standardLabel || climb.standardCode}` : climb.subject === "sg" ? `${singaporePlace(climb.level).short}, ${stepName(climb.subject, climb.level, climb.standardStep ?? 0)}, standard ${(climb.standardStep ?? 0) + 1} of 3` : `${levelLabel(climb.level)}, ${stepName(climb.subject, climb.level, climb.standardStep ?? 0)}, standard ${(climb.standardStep ?? 0) + 1} of 3`} · earned {levelLabel(climb.performanceLevel)}
            </li>
          ))}
        </ul>
      ) : null}
      <button
        type="button"
        className="mt-3 min-h-11 rounded-xl border border-line bg-paper px-4 text-sm text-ink"
        onClick={() => {
          const first = roster[0];
          if (!first) {
            setError("Enroll a student before changing a level.");
            return;
          }
          setError("");
          setChildId(first.id);
          setChanging((open) => !open);
        }}
      >
        Change the working level with the account password. The earned level stays.
      </button>
      {changing && roster.length > 0 ? (
        <div className="mt-3 space-y-2 rounded-xl border border-line bg-paper p-3">
          <label className="block text-sm text-muted">
            Student
            <select
              value={childId}
              onChange={(event) => setChildId(event.target.value)}
              className="mt-1 min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-base text-ink"
            >
              {roster.map((climb) => (
                <option key={climb.id} value={climb.id}>
                  {climb.childName}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm text-muted">
            Account password
            <input
              type="password"
              value={accountPassword}
              onChange={(event) => setAccountPassword(event.target.value)}
              autoComplete="current-password"
              className="mt-1 min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-base text-ink"
            />
          </label>
          <label className="block text-sm text-muted">One step. The password of the person who registered is required. This does not change the level the student has earned.</label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              className="min-h-11 rounded-xl border border-line bg-surface px-4 text-sm text-ink disabled:opacity-50"
              onClick={() => {
                setPending(true);
                setError("");
                if (accountPassword.length < 8) {
                  setError("Enter the password of the account that registered.");
                  setPending(false);
                  return;
                }
                void setClimbLevel({ data: { id: childId, direction: "down", password: accountPassword } })
                  .then(() => {
                    setChanging(false);
                    onLevelsChanged();
                  })
                  .catch((err: unknown) => {
                    setError(err instanceof Error ? err.message : "The level could not be changed.");
                  })
                  .finally(() => setPending(false));
              }}
            >
              Lower the working level. The earned level stays.
            </button>
            <button
              type="button"
              disabled={pending}
              className="min-h-11 rounded-xl border border-line bg-surface px-4 text-sm text-ink disabled:opacity-50"
              onClick={() => {
                setPending(true);
                setError("");
                if (accountPassword.length < 8) {
                  setError("Enter the password of the account that registered.");
                  setPending(false);
                  return;
                }
                void setClimbLevel({ data: { id: childId, direction: "up", password: accountPassword } })
                  .then(() => {
                    setChanging(false);
                    onLevelsChanged();
                  })
                  .catch((err: unknown) => {
                    setError(err instanceof Error ? err.message : "The level could not be changed.");
                  })
                  .finally(() => setPending(false));
              }}
            >
              Raise the working level. The earned level stays.
            </button>
          </div>
        </div>
      ) : null}
      {needsNew ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm text-muted">
            Age
            <input
              type="number"
              min={4}
              max={18}
              value={age}
              onChange={(event) => setAge(Number(event.target.value))}
              className="mt-1 min-h-11 w-full rounded-xl border border-line bg-paper px-3 text-base text-ink"
            />
          </label>
          <label className="block text-sm text-muted">
            Starting grade
            <input
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={gradeText}
              onChange={(event) => setGradeText(event.target.value.replace(/\D/g, "").slice(0, 2))}
              className="mt-1 min-h-11 w-full rounded-xl border border-line bg-paper px-3 text-base text-ink"
            />
          </label>
          <p className="text-sm text-muted sm:col-span-2">The parent is already signed in. The starting grade is saved for this first name.</p>
        </div>
      ) : null}
      {error ? <p className="mt-3 text-sm text-miss">{error}</p> : null}
      {shut ? <p className="mt-3 text-sm text-ink">The 2.5 hours for this login are used. The engines open again at midnight Pacific time.</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="mt-4 min-h-11 w-full rounded-xl bg-accent px-4 text-base font-semibold text-accent-ink disabled:opacity-50"
      >
        {pending ? "Opening…" : needsNew ? "Enroll and begin" : "Continue"}
      </button>
    </form>
  );
}
