import { SCHOOL_SITE } from "@/lib/brand";

export function SchoolPath({ className = "mt-1" }: { className?: string }) {
  return (
    <p className={`${className} text-sm leading-relaxed text-muted`}>
      The climb stays here. The school site has{" "}
      <a
        href={`${SCHOOL_SITE}/meet`}
        target="_blank"
        rel="noreferrer"
        className="inline-flex min-h-11 items-center text-ink underline decoration-line underline-offset-4"
      >
        online live sessions
      </a>{" "}
      and{" "}
      <a
        href={`${SCHOOL_SITE}/testing`}
        target="_blank"
        rel="noreferrer"
        className="inline-flex min-h-11 items-center text-ink underline decoration-line underline-offset-4"
      >
        baseline testing
      </a>
      , when you want them.
    </p>
  );
}
