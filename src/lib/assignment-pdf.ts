import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { levelLabel, subjectMeta, type SubjectId } from "@/lib/climb-rules";
import type { Question } from "@/lib/questions";

const LETTERS = ["A", "B", "C", "D"] as const;

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= width) line = next;
    else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

export async function buildAssignmentPdf(input: {
  childName: string;
  subject: SubjectId;
  level: number;
  questions: Question[];
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.TimesRoman);
  const bold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const meta = subjectMeta(input.subject);
  const ink = rgb(0.11, 0.1, 0.08);
  const muted = rgb(0.33, 0.3, 0.26);
  const width = 612;
  const height = 792;
  const margin = 54;
  const max = width - margin * 2;

  let page = doc.addPage([width, height]);
  let y = height - margin;

  const newPage = () => {
    page = doc.addPage([width, height]);
    y = height - margin;
  };

  const ensure = (needed: number) => {
    if (y - needed < margin) newPage();
  };

  const drawLines = (lines: string[], used: PDFFont, size: number, color = ink, gap = 4) => {
    for (const line of lines) {
      ensure(size + gap);
      page.drawText(line, { x: margin, y: y - size, size, font: used, color });
      y -= size + gap;
    }
  };

  drawLines(wrap("VKOLE/ZPD - Space XSI Integrated Learning Engine", bold, 11, max), bold, 11, ink, 3);
  drawLines(wrap(`VKOLE/${meta.code}  ·  ${meta.name}`, bold, 11, max), bold, 11, muted, 3);
  drawLines(wrap(`${input.childName}  ·  earned ${levelLabel(input.level)}  ·  8-question assignment`, bold, 18, max), bold, 18, ink, 6);
  drawLines(
    wrap("Circle one answer for each item. A parent may keep the answer key on the last page.", font, 11, max),
    font,
    11,
    muted,
    14,
  );

  input.questions.forEach((question, index) => {
    ensure(72);
    drawLines(wrap(`${index + 1}.  ${question.stem}`, bold, 12, max), bold, 12, ink, 3);
    drawLines(wrap(question.standard, font, 9, max), font, 9, muted, 6);
    question.options.slice(0, 4).forEach((option, optionIndex) => {
      const letter = LETTERS[optionIndex] ?? String(optionIndex + 1);
      drawLines(wrap(`${letter}.  ${option}`, font, 12, max - 12), font, 12, ink, 3);
    });
    y -= 4;
    ensure(16);
    page.drawText("Answer:  ____________________", { x: margin, y: y - 12, size: 12, font, color: ink });
    y -= 28;
  });

  newPage();
  drawLines(wrap("Parent answer key", bold, 18, max), bold, 18, ink, 4);
  drawLines(
    wrap(`${input.childName}  ·  VKOLE/${meta.code}  ·  earned ${levelLabel(input.level)}`, font, 12, max),
    font,
    12,
    muted,
    16,
  );
  input.questions.forEach((question, index) => {
    const letterIndex = question.options.findIndex((option) => option === question.answer);
    const letter = LETTERS[letterIndex] ?? "—";
    drawLines(wrap(`${index + 1}.  ${letter}.  ${question.answer}`, bold, 12, max), bold, 12, ink, 3);
    drawLines(wrap(question.note, font, 10, max), font, 10, muted, 10);
  });

  return doc.save();
}

export function assignmentFileName(childName: string, subject: SubjectId, level: number): string {
  const code = subjectMeta(subject).code;
  const who = childName.replace(/[^\w]+/g, "-").replace(/^-|-$/g, "") || "child";
  return `VKOLE-${code}-${who}-${levelLabel(level).replace(/\s+/g, "-")}.pdf`;
}
