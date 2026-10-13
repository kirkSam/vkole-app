import { access, mkdir, writeFile } from "node:fs/promises";
import { assignmentFileName, buildAssignmentPdf } from "@/lib/assignment-pdf";
import { levelLabel, subjectMeta } from "@/lib/climb-rules";
import { makeAssignment } from "@/lib/questions";
import type { AppTime } from "@/lib/academic-email";
import { ConnectorType, type CallToolResult } from "@/lib/app-data/types";

export type AssignmentFile = {
  line: string;
  fileName: string;
  artifactPath: string;
  bytes: Uint8Array;
  subject: AppTime["subject"];
  earnedLevel: number;
};

export async function assignmentFilesFor(childName: string, apps: AppTime[]): Promise<AssignmentFile[]> {
  const worked = apps
    .filter((app) => app.loggedIn && (app.earnedLevel ?? app.level) != null)
    .slice(0, 4);
  if (worked.length === 0) return [];
  const stamp = Date.now();
  const files: AssignmentFile[] = [];
  for (const app of worked) {
    const subject = app.subject;
    const level = Number(app.earnedLevel ?? app.level);
    const questions = makeAssignment(subject, level, 8);
    const bytes = await buildAssignmentPdf({ childName, subject, level, questions });
    const fileName = assignmentFileName(childName, subject, level);
    const artifactPath = `/assignments/${stamp}-${fileName}`;
    try {
      await mkdir("/workspace/artifacts/assignments", { recursive: true });
      await writeFile(`/workspace/artifacts${artifactPath}`, bytes);
    } catch {
      /* The published server may have no artifacts disk. The PDF is still kept in the database. */
    }
    const meta = subjectMeta(subject);
    files.push({
      line: `VKOLE/${meta.code} (${meta.name}), earned ${levelLabel(level)} — ${fileName}`,
      fileName,
      artifactPath,
      bytes,
      subject,
      earnedLevel: level,
    });
  }
  return files;
}

function draftId(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const row = data as Record<string, unknown>;
  const direct = row.draft_id ?? row.draftId ?? row.id;
  if (typeof direct === "string" && direct) return direct;
  const nested = row.draft ?? row.result;
  if (nested && typeof nested === "object") {
    const inner = nested as Record<string, unknown>;
    const id = inner.draft_id ?? inner.draftId ?? inner.id;
    if (typeof id === "string") return id;
  }
  return "";
}

export async function sendAcademicMail(
  to: string,
  subject: string,
  body: string,
  sheets: AssignmentFile[],
  html?: string,
): Promise<CallToolResult> {
  const { callTool } = await import("@/lib/app-data/client.server");
  const gmail = { connectorType: ConnectorType.Gmail };
  const ready: AssignmentFile[] = [];
  for (const sheet of sheets) {
    try {
      await access(`/workspace/artifacts${sheet.artifactPath}`);
      ready.push(sheet);
    } catch {
      /* This copy is not on a disk the mail service can read. */
    }
  }
  const { sendAppMail } = await import("@/lib/app-mail");
  const mailed = await sendAppMail(to, subject, body, html);
  if (mailed === "sent") {
    return { ok: true, data: null };
  }
  if (ready.length === 0) {
    const plain = await callTool("gmail_send_message", { to: [to], subject, body, body_html: html }, gmail);
    if (plain.ok) return plain;
    if (mailed === "none") return { ok: false, data: null, errorMessage: "Mail is not connected" };
    return { ok: false, data: null, errorMessage: "The report was saved. That email address did not accept it." };
  }
  const draft = await callTool("gmail_create_draft", { to: [to], subject, body, body_html: html }, gmail);
  const id = draft.ok ? draftId(draft.data) : "";
  if (!draft.ok || !id) {
    const plain = await callTool("gmail_send_message", { to: [to], subject, body, body_html: html }, gmail);
    if (!plain.ok) return plain;
    return {
      ok: true,
      data: plain.data,
      errorMessage: "The report was sent. The printable assignments could not be attached.",
    };
  }
  for (const sheet of ready) {
    const attached = await callTool(
      "gmail_write_attachment",
      { draft_id: id, artifact_path: sheet.artifactPath, file_name: sheet.fileName, mime_type: "application/pdf" },
      gmail,
    );
    if (!attached.ok) {
      const plain = await callTool("gmail_send_message", { to: [to], subject, body, body_html: html }, gmail);
      if (!plain.ok) return attached;
      return {
        ok: true,
        data: plain.data,
        errorMessage: "The report was sent. The printable assignments could not be attached.",
      };
    }
  }
  return callTool("gmail_send_draft", { draft_id: id }, gmail);
}
