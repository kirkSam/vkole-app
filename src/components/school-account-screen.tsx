import { SCHOOL_ENGINE_URL, SCHOOL_OFFLINE_MESSAGE, schoolScreen } from "@/lib/school-account";
import { Shell } from "@/components/shell";
import { signOut } from "@/lib/auth/client";

export function SchoolAccountScreen({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  const kind = schoolScreen(message) ?? "offline";
  const title =
    kind === "offline"
      ? "The school website is not reachable"
      : kind === "wait"
        ? "Please wait"
        : kind === "separate"
          ? "Use the parent email"
          : "Set the school password";
  return (
    <Shell>
      <p className="text-sm font-semibold tracking-wide text-accent uppercase">Parent</p>
      <h1 className="mt-1 font-display text-4xl text-ink">{title}</h1>
      <p className="mt-4 max-w-prose text-muted">{message || SCHOOL_OFFLINE_MESSAGE}</p>
      {kind === "legacy" ? (
        <p className="mt-3 max-w-prose text-muted">
          Sign out of this older app session, then use Forgot password. The code is emailed only to that address.
        </p>
      ) : null}
      <div className="mt-6 flex flex-wrap gap-3">
        {onRetry ? (
          <button
            type="button"
            className="inline-flex min-h-11 items-center rounded-xl bg-accent px-4 text-base font-semibold text-accent-ink"
            onClick={onRetry}
          >
            Try again
          </button>
        ) : null}
        {kind === "legacy" || kind === "separate" ? (
          <button
            type="button"
            className="inline-flex min-h-11 items-center rounded-xl border border-line bg-paper px-4 text-base text-ink"
            onClick={() => void signOut("/login")}
          >
            Sign in with email
          </button>
        ) : null}
        <a
          className="inline-flex min-h-11 items-center rounded-xl border border-line bg-paper px-4 text-base text-ink"
          href={SCHOOL_ENGINE_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open the school engine
        </a>
      </div>
    </Shell>
  );
}
