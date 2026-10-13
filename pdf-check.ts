import { PDFDocument } from "pdf-lib";
import { makeAssignment } from "./src/lib/questions.ts";
import { buildAssignmentPdf } from "./src/lib/assignment-pdf.ts";

const questions = makeAssignment("ela", 5, 8);
if (questions.length !== 8) throw new Error("expected 8");
const bytes = await buildAssignmentPdf({ childName: "Mira", subject: "ela", level: 5, questions });
const doc = await PDFDocument.load(bytes);
if (doc.getPageCount() < 2) throw new Error("expected an answer-key page");
console.log("pages", doc.getPageCount(), "bytes", bytes.length);
