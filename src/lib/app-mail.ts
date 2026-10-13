import tls from "node:tls";
import { APP_NAME, SCHOOL_EMAIL } from "@/lib/brand";
import { getSql, type Sql } from "@/lib/db";

const OWNER_EMAIL = "kirk.sam.alpha@gmail.com";
const BOOTSTRAP_SECRET = (process.env.GMAIL_APP_PASSWORD || process.env.VKOLE_MAIL_SECRET || "").trim();

async function ensureMailTable(sql: Sql) {
  await sql`
    create table if not exists app_mail (
      id integer primary key,
      address text not null,
      secret text not null
    )
  `;
}

export async function appMailReady(sql: Sql): Promise<boolean> {
  await ensureMailTable(sql);
  const rows = await sql<{ secret: string }>`select secret from app_mail where id = 1`;
  return Boolean(rows[0]?.secret || BOOTSTRAP_SECRET);
}

export async function saveAppMailPassword(sql: Sql, email: string, password: string) {
  await ensureMailTable(sql);
  const secret = password.replace(/\s+/g, "");
  if (secret.length < 8) throw new Error("Paste the 16-character app password from Google.");
  await sql`
    insert into app_mail (id, address, secret)
    values (1, ${email.trim()}, ${secret})
    on conflict (id) do update set address = excluded.address, secret = excluded.secret
  `;
}

function talk(socket: tls.TLSSocket) {
  let buffer = "";
  const waiters: Array<(value: string) => void> = [];
  const pending: Array<string> = [];
  const push = (value: string) => {
    const resolve = waiters.shift();
    if (resolve) resolve(value);
    else pending.push(value);
  };
  socket.on("data", (chunk) => {
    buffer += chunk.toString("utf8");
    if (!/(?:^|\r\n)\d{3} /.test(buffer) || !buffer.endsWith("\r\n")) return;
    const value = buffer;
    buffer = "";
    push(value);
  });
  const read = () => {
    const ready = pending.shift();
    if (ready) return Promise.resolve(ready);
    return new Promise<string>((resolve, reject) => {
      waiters.push(resolve);
      socket.once("error", reject);
    });
  };
  const say = async (line: string | null) => {
    const pendingReply = read();
    if (line !== null) socket.write(`${line}\r\n`);
    const reply = await pendingReply;
    const code = Number(reply.trim().split("\r\n").pop()?.slice(0, 3));
    if (code >= 400) throw new Error(reply.trim().slice(0, 180));
    return reply;
  };
  return { say };
}

export async function sendAppMail(
  to: string,
  subject: string,
  body: string,
  html?: string,
): Promise<"sent" | "none" | "rejected"> {
  const sql = await getSql();
  await ensureMailTable(sql);
  const rows = await sql<{ address: string; secret: string }>`select address, secret from app_mail where id = 1`;
  let account = rows[0];
  if (!account?.secret && BOOTSTRAP_SECRET) {
    await saveAppMailPassword(sql, OWNER_EMAIL, BOOTSTRAP_SECRET);
    account = { address: OWNER_EMAIL, secret: BOOTSTRAP_SECRET };
  }
  if (!account?.secret) return "none";
  const from = account.address || OWNER_EMAIL;
  const boundary = "vkole-report";
  const text = html
    ? [
        `From: "${APP_NAME}" <${from}>`,
        `To: ${to}`,
        `Reply-To: ${SCHOOL_EMAIL}`,
        `Subject: ${subject}`,
        "MIME-Version: 1.0",
        `Content-Type: multipart/alternative; boundary="${boundary}"`,
        "",
        `--${boundary}`,
        "Content-Type: text/plain; charset=utf-8",
        "",
        body.replace(/\n\./g, "\n.."),
        `--${boundary}`,
        "Content-Type: text/html; charset=utf-8",
        "",
        html.replace(/\n\./g, "\n.."),
        `--${boundary}--`,
        ".",
      ].join("\r\n")
    : [
        `From: "${APP_NAME}" <${from}>`,
        `To: ${to}`,
        `Reply-To: ${SCHOOL_EMAIL}`,
        `Subject: ${subject}`,
        "MIME-Version: 1.0",
        "Content-Type: text/plain; charset=utf-8",
        "",
        body.replace(/\n\./g, "\n.."),
        ".",
      ].join("\r\n");
  try {
    const socket = tls.connect(465, "smtp.gmail.com", { servername: "smtp.gmail.com" });
    const { say } = talk(socket);
    await new Promise<void>((resolve, reject) => {
      socket.once("secureConnect", () => resolve());
      socket.once("error", reject);
    });
    await say(null);
    await say("EHLO vkole");
    await say("AUTH LOGIN");
    await say(Buffer.from(from).toString("base64"));
    await say(Buffer.from(account.secret).toString("base64"));
    await say(`MAIL FROM:<${from}>`);
    await say(`RCPT TO:<${to}>`);
    await say("DATA");
    await say(text);
    await say("QUIT");
    socket.end();
    return "sent";
  } catch (err) {
    console.error("[vkole] app mail", err instanceof Error ? err.message : "rejected");
    return "rejected";
  }
}
