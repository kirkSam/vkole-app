import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";

function pdfBytes(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) return value;
  if (typeof value === "string") {
    const hex = value.startsWith("\\x") ? value.slice(2) : "";
    if (hex) return Uint8Array.from(Buffer.from(hex, "hex"));
    return Uint8Array.from(Buffer.from(value, "base64"));
  }
  return new Uint8Array();
}

export const Route = createFileRoute("/api/assignment/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const id = params.id?.trim() ?? "";
        if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });
        const sql = await getSql();
        const rows = await sql.query<{ file_name: string; pdf: unknown }>(
          "select file_name, pdf from assignment_sheets where id = $1",
          [id],
        );
        const row = rows[0];
        const bytes = row ? pdfBytes(row.pdf) : new Uint8Array();
        if (!row || bytes.byteLength === 0) return new Response("Not found", { status: 404 });
        const name = row.file_name.replace(/[^\w.\-]+/g, "-") || "assignment.pdf";
        return new Response(Buffer.from(bytes), {
          headers: {
            "content-type": "application/pdf",
            "content-disposition": `attachment; filename="${name}"`,
            "cache-control": "private, max-age=3600",
          },
        });
      },
    },
  },
});
