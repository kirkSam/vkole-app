/**
 * Who may see an account. A parent sees only the email they signed in with.
 * A teacher list is a separate check and is never an email body.
 */

export function normalizeAccountEmail(raw: string): string {
  return raw.normalize("NFKC").replace(/[\s\u00a0\u200b]+/g, "").trim().toLowerCase();
}

/**
 * The website account id is the lowercase email. A case-sensitive website
 * still gets the typed spelling when that spelling is different.
 */
export function accountEmailForms(raw: string): string[] {
  const compact = raw.normalize("NFKC").replace(/[\s\u00a0\u200b]+/g, "").trim();
  const lower = compact.toLowerCase();
  if (!lower.includes("@")) return [];
  return lower === compact ? [lower] : [lower, compact];
}

export function sameAccount(left: string, right: string): boolean {
  const a = normalizeAccountEmail(left);
  const b = normalizeAccountEmail(right);
  return a.length > 0 && a === b;
}

/** Parent screens and parent mail. Other families are dropped. */
export function accountsVisibleTo<T extends { email: string }>(signedInEmail: string, rows: readonly T[]): T[] {
  return rows.filter((row) => sameAccount(row.email, signedInEmail));
}

/**
 * A notice about one account. The body names that account and no other address.
 */
export function singleAccountNotice(account: { email: string; name?: string }): { email: string; subject: string; body: string } {
  const email = normalizeAccountEmail(account.email);
  const name = (account.name ?? "").trim();
  const line = name ? `${email} · ${name}` : email;
  return {
    email,
    subject: `VKOLE/ZPD - Space XSI Integrated Learning Engine registration: ${email}`,
    body: ["A registration was saved for this account.", "", line, "", "This notice names only this account."].join("\n"),
  };
}

export function noticeNamesOnly(body: string, email: string, others: readonly string[]): boolean {
  const text = body.toLowerCase();
  const own = normalizeAccountEmail(email);
  if (!own || !text.includes(own)) return false;
  return others.every((other) => {
    const id = normalizeAccountEmail(other);
    return !id || id === own || !text.includes(id);
  });
}

const EMAIL_IN_TEXT = /[a-z0-9][a-z0-9._%+-]*@[a-z0-9.-]+\.[a-z]{2,}/gi;

/** Addresses written in a message. Comparison stays exact after normalization. */
export function emailsInText(text: string): string[] {
  const found = text.normalize("NFKC").toLowerCase().match(EMAIL_IN_TEXT) ?? [];
  return [...new Set(found.map((item) => normalizeAccountEmail(item)))];
}

/**
 * A parent message may name only the account it is sent to, plus the school desk.
 * "All registrations" is a roster and is never allowed.
 * Gmail delivers kirk.sam.alpha@gmail.com and kirksamalpha@gmail.com to one inbox.
 * Those spellings stay different accounts. A roster must not be sent to either one.
 */
export function parentMailStaysOnAccount(to: string, body: string, schoolEmail = ""): boolean {
  const recipient = normalizeAccountEmail(to);
  if (!recipient.includes("@")) return false;
  if (body.toLowerCase().includes("all registrations")) return false;
  const school = normalizeAccountEmail(schoolEmail);
  const allowed = new Set([recipient, school].filter((item) => item.includes("@")));
  return emailsInText(body).every((email) => allowed.has(email));
}

/** SMTP setup for the app. This is not permission to see other families. */
export const APP_MAIL_OPERATOR = "kirk.sam.alpha@gmail.com";

/**
 * The Gmail form. The dotted operator spelling is not the ordinary parent
 * kirksamalpha@gmail.com, and neither spelling receives a registrant list.
 */
export function mayAllowAppMail(email: string, masterRaw: string | undefined): boolean {
  const id = normalizeAccountEmail(email);
  if (id === APP_MAIL_OPERATOR) return true;
  return teacherEmails(masterRaw, undefined).includes(id);
}

/** Comma-separated teacher addresses. Parents are not on this list. */
export function teacherEmails(masterRaw: string | undefined, adminRaw: string | undefined): string[] {
  const parsed = `${masterRaw ?? ""},${adminRaw ?? ""}`
    .split(",")
    .map((item) => normalizeAccountEmail(item))
    .filter((item) => item.includes("@"));
  return [...new Set(parsed)];
}

/**
 * The full registrant list is teacher-only. It is not a parent view and it is not mailed.
 */
export function mayListEveryRegistrant(viewerEmail: string, teachers: readonly string[]): boolean {
  return teachers.some((teacher) => sameAccount(teacher, viewerEmail));
}
