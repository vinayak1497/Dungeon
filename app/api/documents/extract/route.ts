import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, RESOURCES_BUCKET } from "@/utils/supabase/service";
import { extOf } from "@/lib/uploads";

export const runtime = "nodejs";
export const maxDuration = 60;

function err(code: string, message: string, status = 400) {
  return NextResponse.json({ error: { code, message } }, { status });
}

// Makes an uploaded file usable as grounding source: returns extracted text
// for text-like formats, page-aware text for PDFs, and honest metadata for
// formats needing a future extractor (slides audio scans).
export async function GET(req: NextRequest) {
  let sb;
  try {
    sb = createServiceClient();
  } catch (e) {
    return err("not_configured", e instanceof Error ? e.message : "Storage not configured.", 500);
  }
  const { searchParams } = new URL(req.url);
  const path = searchParams.get("path") ?? "";
  if (!path || path.includes("..")) return err("bad_path", "Supply ?path=<storage path>.");

  const { data, error } = await sb.storage.from(RESOURCES_BUCKET).download(path);
  if (error || !data) return err("not_found", error?.message ?? "File not found.", 404);

  const buf = Buffer.from(await data.arrayBuffer());
  const ext = extOf(path);
  const maxChars = 60000;

  if (["txt", "md", "csv", "tsv", "json"].includes(ext)) {
    const text = buf.toString("utf-8").slice(0, maxChars);
    return NextResponse.json({ path, ext, status: "extracted", chars: text.length, truncated: buf.length > maxChars, text });
  }

  if (ext === "pdf") {
    try {
      // Direct lib import: package root runs a self-test on import that
      // throws ENOENT inside Next.js server bundles.
      const mod = await import("pdf-parse/lib/pdf-parse.js");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parse = (mod as any).default ?? (mod as any);
      const out = await parse(buf);
      const text: string = (out.text ?? "").slice(0, maxChars);
      return NextResponse.json({
        path,
        ext,
        status: text.trim() ? "extracted" : "empty",
        pages: out.numpages ?? null,
        chars: text.length,
        truncated: (out.text ?? "").length > maxChars,
        text,
        note: text.trim() ? undefined : "No extractable text (likely scanned). Keep the file as source; OCR lands in the ingestion phase."
      });
    } catch (e) {
      return err("extract_failed", e instanceof Error ? e.message : "PDF parse failed.", 500);
    }
  }

  return NextResponse.json({
    path,
    ext,
    status: "needs_extraction",
    bytes: buf.length,
    note: "Stored and listed as source. Text extraction for slides/office/audio/image formats lands with the document-ingestion phase; the file URL is already usable for viewing and future grounding."
  });
}
