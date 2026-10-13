import { useState, type FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { GROK_PROVIDERS, authClient, signIn } from "@/lib/auth/client";
import { confirmPasswordReset, requestPasswordReset, requestUsernameReminder } from "@/lib/recovery";
import { recordLogin } from "@/lib/ledger";
import { beginSharedTrial } from "@/lib/climbs";
import { Shell } from "@/components/shell";

type Mode = "in" | "up" | "forgot-password" | "reset-password" | "forgot-username";

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
  const [code, setCode] = useState("");
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
    if ((mode === "in" || mode === "up" || mode === "reset-password") && password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    setPending(true);
    try {
      if (mode === "forgot-password") {
        const result = await requestPasswordReset({ data: { email: email.trim() } });
        setNote(
          result.delivered
            ? "If that email is on an account, a 6-digit code is on its way. It expires in 30 minutes."
            : result.code
              ? `Email is not connected, so the code is shown here: ${result.code}. It expires in 30 minutes.`
              : "If that email is on an account, a 6-digit code is on its way.",
        );
        setMode("reset-password");
        return;
      }
      if (mode === "reset-password") {
        await confirmPasswordReset({ data: { email: email.trim(), code: code.trim(), password } });
        setPassword("");
        setCode("");
        setNote("Password updated. Sign in with the new one.");
        setMode("in");
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
        const res = await authClient.signUp.email({
          email: email.trim(),
          password,
          name: name.trim() || "Parent",
        });
        if (res.error) {
          const message = res.error.message ?? "Could not create the parent account.";
          setError(
            /already exists/i.test(message)
              ? "That email is already registered. Use Sign in, and the same password you chose when you created it."
              : message,
          );
          return;
        }
      } else {
        const res = await authClient.signIn.email({
          email: email.trim(),
          password,
        });
        if (res.error) {
          setError(res.error.message ?? "Email or password did not match.");
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
      : mode === "forgot-password" || mode === "reset-password"
        ? "Forgot password"
        : mode === "forgot-username"
          ? "Forgot username"
          : "Sign in to start a session";

  const lead =
    mode === "up"
      ? "No credit card is required for the first seven days. Only this email registration. Any email address may be used. It does not have to be Gmail. This registration opens all four engines for this student. Another student registers on their own device. Reports are sent only to this address."
      : mode === "forgot-password"
        ? "Enter the email on the account. A 6-digit code will be sent there."
        : mode === "reset-password"
          ? "Enter the code from the email and choose a new password."
          : mode === "forgot-username"
            ? "The username is the email on the account. Enter the name you used when you created it. That email will be sent to the address on file."
            : "This sign-in is for one student. The four engines share that student’s 7-day trial. A name already on file continues at the saved Common Core level.";

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
        {mode === "reset-password" ? (
          <label className="block text-sm text-muted">
            Code from the email
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
        {mode === "in" || mode === "up" || mode === "reset-password" ? (
          <label className="block text-sm text-muted">
            {mode === "reset-password" ? "New password" : "Password"}
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
                : mode === "reset-password"
                  ? "Save new password"
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
      {mode === "in" || mode === "up" ? (
        <div className="mt-6 space-y-2">
          <p className="text-sm text-muted">Or continue with</p>
          {GROK_PROVIDERS.map((provider) => (
            <button
              key={provider.providerId}
              type="button"
              onClick={() => signIn(provider.providerId, { callbackURL: "/" })}
              className="min-h-11 w-full rounded-xl border border-line bg-paper px-4 text-sm text-ink"
            >
              Continue with {provider.label}
            </button>
          ))}
        </div>
      ) : null}
    </Shell>
  );
}
