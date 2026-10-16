import { officeOffer } from "@/lib/school-account";

/** What the website read profile says about this parent's student office. */
export function StudentOffice({
  purchased,
  slug,
  tone = "paper",
}: {
  purchased: boolean;
  slug: string | null;
  tone?: "paper" | "night";
}) {
  const offer = officeOffer(purchased, slug);
  const linkClass = tone === "night" ? "text-[#e6c65c] underline" : "text-accent underline";
  if (offer.kind === "office") {
    return (
      <p className={tone === "night" ? "mt-4 text-sm leading-relaxed text-[#f4f1ea]" : "mt-4 text-sm text-ink"}>
        <a className={linkClass} href={offer.href} target="_blank" rel="noopener noreferrer">
          Sign in to the student office
        </a>{" "}
        with the same email and password.
      </p>
    );
  }
  return (
    <p className={tone === "night" ? "mt-4 text-sm leading-relaxed text-[#f4f1ea]" : "mt-4 text-sm text-ink"}>
      A student office comes with the{" "}
      <a className={linkClass} href={offer.href} target="_blank" rel="noopener noreferrer">
        first-month package
      </a>
      .
    </p>
  );
}
