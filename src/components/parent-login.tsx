import { useState, type FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { schoolPasswordReset, schoolSignIn, schoolSignUp } from "@/lib/school-auth";
import { SCHOOL_ENGINE_URL, SCHOOL_SEPARATE_MESSAGE, schoolScreen } from "@/lib/school-account";
import { requestUsernameReminder } from "@/lib/recovery";
import { recordLogin } from "@/lib/ledger";
import { beginSharedTrial } from "@/lib/climbs";
import { SchoolAccountScreen } from "@/components/school-account-screen";
import { Shell } from "@/components/shell";

type Mode = "in" | "up" | "forgot-password" | "forgot-username";

export function ParentLogin({
  onSplash,
  initialMode = "in",
  onAccountReady,
}: {
  onSplash?: () => void;
  initialMode?: Mode;
  onAccountReady?: () => void;
}) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);

  function go(next: Mode) {
    setMode(next);
    setError("");
    setNote("");
    setPending(false);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setNote("");
    if ((mode === "in" || mode === "up") && password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    setPending(true);
    try {
      if (mode === "forgot-password") {
        const result = await schoolPasswordReset({ data: { email: email.trim() } });
        if (!result.ok) {
          setError(result.message);
          return;
        }
        setNote(
          "If the school has that email, a 6-digit code is on its way. It expires in 30 minutes. Set the new password on the school website, then sign in here. The code is not shown on this screen.",
        );
        return;
      }
      if (mode === "forgot-username") {
        const result = await requestUsernameReminder({ data: { name: name.trim() } });
        setNote(
          result.delivered
            ? "If an account uses that name, the sign-in email was sent to the address on the account."
            : result.emails.length
              ? `Email is not connected. The sign-in email for that name is ${result.emails.join(", ")}.`
              : "No account uses that name.",
        );
        return;
      }
      if (mode === "up") {
        const res = await schoolSignUp({ data: { email: email.trim(), password, name: name.trim() || "Parent" } });
        if (!res.ok) {
          setError(res.message);
          return;
        }
      } else {
        const res = await schoolSignIn({ data: { email: email.trim(), password } });
        if (!res.ok) {
          setError(res.message);
          return;
        }
      }
      await recordLogin({ data: { kind: mode === "up" ? "sign-up" : "sign-in" } }).catch(() => undefined);
      sessionStorage.removeItem("vkole-sync-trial");
      await beginSharedTrial().catch(() => undefined);
      onAccountReady?.();
      await navigate({ to: "/" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "That step failed.");
    } finally {
      setPending(false);
    }
  }

  const title =
    mode === "up"
      ? "Create a parent account"
      : mode === "forgot-password"
        ? "Forgot password"
        : mode === "forgot-username"
          ? "Forgot username"
          : "Sign in to start a session";

  const lead =
    mode === "up"
      ? "No credit card is required for the first seven days. Only this email registration. Any email address may be used. It does not have to be Gmail. This registration opens all five engines for this student. Another student registers on their own device. Reports are sent only to this address."
        : mode === "forgot-password"
        ? "Enter the email on the account. A 6-digit code is emailed only to that address. Set the new password on the school website, then sign in here."
        : mode === "forgot-username"
            ? "The username is the email on the account. Enter the name you used when you created it. That email will be sent to the address on file."
            : "This sign-in uses the school website. The engines share that student’s 7-day trial, level, and clock. Google and X do not open this account.";

  if (schoolScreen(error)) {
    return <SchoolAccountScreen message={error} onRetry={() => setError("")} />;
  }

  return (
    <Shell onSplash={onSplash}>
      <p className="text-sm font-semibold tracking-wide text-accent uppercase">Parent</p>
      <h1 className="mt-1 font-display text-4xl text-ink">{title}</h1>
      <p className="mt-3 max-w-prose text-muted">{lead}</p>
      <form onSubmit={submit} className="mt-6 space-y-3 rounded-2xl border border-line bg-surface p-5">
        {mode === "up" || mode === "forgot-username" ? (
          <label className="block text-sm text-muted">
            Your name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              required
              className="mt-1 min-h-11 w-full rounded-xl border border-line bg-paper px-3 text-base text-ink"
            />
          </label>
        ) : null}
        {mode !== "forgot-username" ? (
          <label className="block text-sm text-muted">
            {mode === "up" ? "Email for your children’s reports" : "Email"}
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="mt-1 min-h-11 w-full rounded-xl border border-line bg-paper px-3 text-base text-ink"
            />
          </label>
        ) : null}
        {mode === "in" || mode === "up" ? (
          <label className="block text-sm text-muted">
            Password
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "in" ? "current-password" : "new-password"}
              className="mt-1 min-h-11 w-full rounded-xl border border-line bg-paper px-3 text-base text-ink"
            />
          </label>
        ) : null}
        {note ? <p className="text-sm text-ink">{note}</p> : null}
        {error ? <p className="text-sm text-miss">{error}</p> : null}
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 w-full rounded-xl bg-accent px-4 text-base font-semibold text-accent-ink disabled:opacity-50"
        >
          {pending
            ? "Working…"
            : mode === "up"
              ? "Create account"
              : mode === "forgot-password"
                ? "Send code"
                : mode === "forgot-username"
                  ? "Send my username"
                  : "Sign in and start"}
        </button>
        {mode === "in" ? (
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            <button type="button" className="min-h-11 text-sm text-accent" onClick={() => go("forgot-password")}>
              Forgot password
            </button>
            <button type="button" className="min-h-11 text-sm text-accent" onClick={() => go("forgot-username")}>
              Forgot username
            </button>
          </div>
        ) : (
          <button type="button" className="min-h-11 w-full text-sm text-ink" onClick={() => go("in")}>
            Back to sign in
          </button>
        )}
        {mode === "in" || mode === "up" ? (
          <button
            type="button"
            className="min-h-11 w-full rounded-xl border border-line bg-paper px-4 text-sm text-ink"
            onClick={() => go(mode === "in" ? "up" : "in")}
          >
            {mode === "in" ? "Need an account? Create one" : "Already have an account? Sign in"}
          </button>
        ) : null}
      </form>
      <p className="mt-6 max-w-prose text-sm text-muted">{SCHOOL_SEPARATE_MESSAGE}</p>
      <a
        className="mt-3 inline-flex min-h-11 items-center text-sm text-accent"
        href={SCHOOL_ENGINE_URL}
        target="_blank"
        rel="noopener noreferrer"
      >
        Open the school engine to pay or set a password
      </a>
    </Shell>
  );
}
