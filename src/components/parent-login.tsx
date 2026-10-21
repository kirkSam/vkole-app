import { useEffect, useState, type FormEvent } from "react";
import { schoolPasswordConfirm, schoolPasswordReset, schoolSignIn, schoolSignUp } from "@/lib/school-auth";
import { readDeviceId } from "@/lib/device-id";
import { schoolScreen } from "@/lib/school-account";
import { SIGN_IN_AGAIN_NOTE } from "@/lib/account-purge";
import { rememberAppSession } from "@/lib/auth/client";
import { recordLogin } from "@/lib/ledger";
import { beginSharedTrial } from "@/lib/climbs";
import { SchoolAccountScreen } from "@/components/school-account-screen";
import { Shell } from "@/components/shell";

type Mode = "in" | "up" | "forgot" | "reset";

const LEAD =
  "The parent signs in or creates the account. Progress reports and recovery codes are sent only to this email.";

export function ParentLogin({
  onSplash,
  initialMode = "in",
  onAccountReady,
}: {
  onSplash?: () => void;
  initialMode?: "in" | "up";
  onAccountReady?: () => void;
}) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    try {
      const note = sessionStorage.getItem(SIGN_IN_AGAIN_NOTE);
      if (!note) return;
      sessionStorage.removeItem(SIGN_IN_AGAIN_NOTE);
      setError(note);
    } catch {
      /* storage may be unavailable */
    }
  }, []);

  function go(next: Mode) {
    setMode(next);
    setError("");
    setNote("");
    setPending(false);
  }

  async function enterApp(sessionToken: string) {
    if (sessionToken) rememberAppSession(sessionToken);
    await recordLogin({ data: { kind: mode === "up" ? "sign-up" : "sign-in" } }).catch(() => undefined);
    sessionStorage.removeItem("vkole-sync-trial");
    sessionStorage.removeItem("vkole-account-gone");
    await beginSharedTrial().catch(() => undefined);
    onAccountReady?.();
    window.location.assign("/?open=1");
  }

  async function sendCode() {
    setError("");
    setNote("");
    setPending(true);
    try {
      const result = await schoolPasswordReset({ data: { email: email.trim() } });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setMode("reset");
      if (mode !== "reset") setPassword("");
      setNote("A code is on its way. Enter the code and a new password.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "That step failed.");
    } finally {
      setPending(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (mode === "forgot") {
      await sendCode();
      return;
    }
    if ((mode === "in" || mode === "up" || mode === "reset") && password.length < 8) {
      setError(mode === "in" ? "Use at least 8 characters." : "The new password needs at least 8 characters.");
      return;
    }
    if (mode === "reset" && code.trim().length === 0) {
      setError("Enter the code from the email.");
      return;
    }
    setNote("");
    setPending(true);
    try {
      if (mode === "reset") {
        const result = await schoolPasswordConfirm({
          data: { email: email.trim(), code: code.trim(), newPassword: password },
        });
        if (!result.ok) {
          setError(result.message);
          return;
        }
        setPassword("");
        setCode("");
        setMode("in");
        setNote("The new password is saved. Sign in with it.");
        return;
      }
      const deviceId = readDeviceId();
      if (mode === "up") {
        const res = await schoolSignUp({ data: { email: email.trim(), password, name: "Parent", ...(deviceId ? { deviceId } : {}) } });
        if (!res.ok) {
          setError(res.message);
          return;
        }
        await enterApp(res.sessionToken);
        return;
      }
      const res = await schoolSignIn({ data: { email: email.trim(), password, ...(deviceId ? { deviceId } : {}) } });
      if (!res.ok) {
        if (res.reason === "gone") {
          const { clearStaleSignIn } = await import("@/lib/account-purge");
          await clearStaleSignIn();
        }
        setError(res.message);
        return;
      }
      await enterApp(res.sessionToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That step failed.");
    } finally {
      setPending(false);
    }
  }

  const title = mode === "up" ? "Create account" : mode === "forgot" || mode === "reset" ? "Forgot password" : "Sign in";

  if (schoolScreen(error)) {
    return <SchoolAccountScreen message={error} onRetry={() => setError("")} />;
  }

  return (
    <Shell onSplash={onSplash}>
      <p className="text-sm font-semibold tracking-wide text-accent uppercase">Parent</p>
      <h1 className="mt-1 font-display text-4xl text-ink">{title}</h1>
      <p className="mt-3 max-w-prose text-muted">{mode === "in" || mode === "up" ? LEAD : "A code is emailed only to the address on the account."}</p>
      <form onSubmit={submit} className="mt-6 space-y-3 rounded-2xl border border-line bg-surface p-5">
        {mode === "reset" ? (
          <p className="text-sm text-ink">
            Email for your children's reports
            <span className="mt-1 block text-base">{email.trim()}</span>
          </p>
        ) : (
          <label className="block text-sm text-muted">
            Email for your children's reports
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              className="mt-1 min-h-11 w-full rounded-xl border border-line bg-paper px-3 text-base text-ink"
            />
          </label>
        )}
        {mode === "reset" ? (
          <label className="block text-sm text-muted">
            Code
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="mt-1 min-h-11 w-full rounded-xl border border-line bg-paper px-3 text-base text-ink"
            />
          </label>
        ) : null}
        {mode === "in" || mode === "up" || mode === "reset" ? (
          <label className="block text-sm text-muted">
            {mode === "reset" ? "New password" : "Password"}
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
          {pending ? "Working…" : mode === "up" ? "Create account" : mode === "forgot" ? "Send code" : mode === "reset" ? "Save new password" : "Sign in"}
        </button>
        {mode === "reset" ? (
          <button type="button" className="min-h-11 w-full text-sm text-accent" disabled={pending} onClick={() => void sendCode()}>
            Send code
          </button>
        ) : null}
        {mode === "in" ? (
          <button type="button" className="min-h-11 text-sm text-accent" onClick={() => go("forgot")}>
            Forgot password
          </button>
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
            {mode === "in" ? "Create account" : "Sign in"}
          </button>
        ) : null}
      </form>
    </Shell>
  );
}
