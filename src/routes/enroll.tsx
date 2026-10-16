import { createFileRoute, Link } from "@tanstack/react-router";
import { APP_NAME } from "@/lib/brand";
import { Shell } from "@/components/shell";
import { SCHOOL_ENGINE_URL } from "@/lib/school-account";

export const Route = createFileRoute("/enroll")({ component: EnrollPage });

const RECEIVES = [
  "All five engines: mathematics, Singapore mathematics, English language arts, history and social studies, and general study.",
  "One registration is one student. Another student downloads the app to their own device and registers there.",
  "A record of each child’s work, emailed to the address given at registration when the child presses Finished or Log out on one engine, or after 5 minutes with no activity. The other engines stay open. Singapore mathematics adds a mastery report by strand.",
  "You may raise or lower the level a student is working on. The level that student has earned stays on the record.",
  "An eight-question assignment in each engine, answered online or printed.",
  "Continued tracking, and the child’s access to VKOLE/ZPD - Space x.AI Integrated Learning Engine.",
];

function EnrollPage() {
  return (
    <Shell>
      <p className="text-sm font-semibold tracking-wide text-accent uppercase">Parent</p>
      <h1 className="mt-1 font-display text-3xl leading-tight text-ink">{APP_NAME}</h1>
      <p className="mt-2 text-sm text-muted">One week FREE.</p>
      <p className="mt-4 font-display text-3xl text-ink">$9.00 USD + tax a month, or $79.00 USD + tax a year, for this student</p>
      <p className="mt-3 text-muted">
        Paying opens the school website, where the card is charged. This app does not charge the card, and it does not store the card number.
      </p>
      <h2 className="mt-8 font-display text-2xl text-ink">What you receive</h2>
      <ul className="mt-3 space-y-3 text-ink">
        {RECEIVES.map((item) => (
          <li key={item} className="rounded-2xl border border-line bg-surface px-4 py-3">
            {item}
          </li>
        ))}
      </ul>
      <p className="mt-6 text-sm text-muted">
        This payment covers this student for a full month or a full year, starting the day you pay. Another student downloads the app and registers on that student’s own device. That registration has its own start date. When this student’s paid time ends, the engines close until you pay again. You may cancel before then. The student’s record stays.
      </p>
      <a
        className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#e6c65c] px-4 text-base font-semibold text-[#1c1408]"
        href={SCHOOL_ENGINE_URL}
        target="_blank"
        rel="noopener noreferrer"
      >
        $79.00 USD + tax a year for this student · Stripe Secure Pay
      </a>
      <a
        className="mt-3 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#e6c65c] px-4 text-base font-semibold text-[#1c1408]"
        href={SCHOOL_ENGINE_URL}
        target="_blank"
        rel="noopener noreferrer"
      >
        $9.00 USD + tax a month for this student · Stripe Secure Pay
      </a>
      <p className="mt-3 text-sm text-muted">
        Paying opens the school website. This app does not mark the account paid, and it does not charge the card.
      </p>
      <Link to="/" className="mt-4 inline-flex min-h-11 items-center text-sm text-accent">
        Back
      </Link>
    </Shell>
  );
}
