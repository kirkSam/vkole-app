export function SchoolPath({ className = "mt-1" }: { className?: string }) {
  return (
    <p className={`${className} text-sm leading-relaxed text-muted`}>
      The climb stays here. The school site has{" "}
      <a
        href="https://dotheimpossible.ai/parents"
        target="_blank"
        rel="noreferrer"
        className="text-ink underline decoration-line underline-offset-4"
      >
        online live sessions
      </a>{" "}
      and{" "}
      <a
        href="https://dotheimpossible.ai/adol"
        target="_blank"
        rel="noreferrer"
        className="text-ink underline decoration-line underline-offset-4"
      >
        baseline testing
      </a>
      , when you want them.
    </p>
  );
}
