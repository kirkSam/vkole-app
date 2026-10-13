/**
 * What this store build collects, and what the school site collects if a parent opens it.
 * The store checklist repeats these ids. Tests check that the checklist still names them.
 */
export type DataRow = {
  id: string;
  collectedBy: "this app" | "school site, if opened";
  what: string;
  where: string;
  linkedToIdentity: "no" | "yes, on the school site";
  purpose: string;
};

export const DATA_INVENTORY: readonly DataRow[] = [
  {
    id: "device-practice",
    collectedBy: "this app",
    what: "Subject, grade, standard, and how many answers were correct",
    where: "On the device only",
    linkedToIdentity: "no",
    purpose: "Show the next offline worksheet",
  },
  {
    id: "device-reminder",
    collectedBy: "this app",
    what: "Whether a daily reminder is on, and the hour and minute",
    where: "On the device only. The notification is scheduled locally",
    linkedToIdentity: "no",
    purpose: "Remind the family to practice",
  },
  {
    id: "school-site-email",
    collectedBy: "school site, if opened",
    what: "Parent email",
    where: "The school site, in that browser, and on the school record when an office is used",
    linkedToIdentity: "yes, on the school site",
    purpose: "Registration and progress mail, as the site privacy page describes",
  },
  {
    id: "school-site-password-hash",
    collectedBy: "school site, if opened",
    what: "A hash of the registration password, not the password itself",
    where: "The school site says this stays in the browser until erased",
    linkedToIdentity: "yes, on the school site",
    purpose: "Sign in to an engine on that device",
  },
  {
    id: "school-site-student-name",
    collectedBy: "school site, if opened",
    what: "Student first name",
    where: "The school site",
    linkedToIdentity: "yes, on the school site",
    purpose: "The student's office and engine",
  },
  {
    id: "school-site-progress",
    collectedBy: "school site, if opened",
    what: "Starting grade, level reached, missed work, and questions already given",
    where: "The school site says the engine copy stays in the browser",
    linkedToIdentity: "yes, on the school site",
    purpose: "Place the next assignment",
  },
  {
    id: "school-site-xai",
    collectedBy: "school site, if opened",
    what: "Subject, grade, the question, and the student's answer",
    where: "Sent to Space x.AI when the site grades a question",
    linkedToIdentity: "yes, on the school site",
    purpose: "Grade the answer and write the next question",
  },
  {
    id: "school-site-mail",
    collectedBy: "school site, if opened",
    what: "A finished sitting, emailed to the registration address",
    where: "Email from the school",
    linkedToIdentity: "yes, on the school site",
    purpose: "Tell that parent how the sitting went",
  },
  {
    id: "school-site-stripe",
    collectedBy: "school site, if opened",
    what: "Card payment on Stripe. The site says the school never sees the card number",
    where: "Stripe checkout on the website",
    linkedToIdentity: "yes, on the school site",
    purpose: "Pay for a website plan",
  },
  {
    id: "school-site-meeting",
    collectedBy: "school site, if opened",
    what: "A scheduled meeting: parent name, email, student name, date, and time",
    where: "The school record",
    linkedToIdentity: "yes, on the school site",
    purpose: "Book a live session",
  },
];

export const NOT_COLLECTED = [
  "advertising id",
  "location",
  "contacts",
  "photos",
  "third-party analytics",
] as const;
