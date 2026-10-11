import "server-only";
import { createServiceClient, RESOURCES_BUCKET } from "@/utils/supabase/service";
import { extOf } from "@/lib/uploads";

export type Extracted = {
  text: string;
  pages: number | null;
  empty: boolean;
  unsupported?: boolean;
  note?: string;
};

const MAX_CHARS = 120000;

export async function downloadObject(path: string): Promise<Buffer> {
  const sb = createServiceClient();
  const { data, error } = await sb.storage.from(RESOURCES_BUCKET).download(path);
  if (error || !data) throw new Error(error?.message ?? "File not found.");
  return Buffer.from(await data.arrayBuffer());
}

export async function extractBuffer(buf: Buffer, ext: string): Promise<Extracted> {
  if (["txt", "md", "csv", "tsv", "json"].includes(ext)) {
    const text = buf.toString("utf-8").slice(0, MAX_CHARS);
    return { text, pages: 1, empty: !text.trim() };
  }
  if (ext === "pdf") {
    // NOTE: import the lib file directly — the package root runs a
    // self-test on import (!module.parent) that throws ENOENT in bundles.
    const mod = await import("pdf-parse/lib/pdf-parse.js");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parse = (mod as any).default ?? (mod as any);
    const out = await parse(buf);
    const text: string = (out.text ?? "").slice(0, MAX_CHARS);
    return {
      text,
      pages: out.numpages ?? null,
      empty: !text.trim(),
      note: text.trim() ? undefined : "No extractable text (likely scanned or image-only)."
    };
  }
  return {
    text: "",
    pages: null,
    empty: true,
    unsupported: true,
    note: `Text extraction for .${ext} is not supported yet. The file is stored and viewable; mapping uses filename and syllabus context.`
  };
}

// Splits text into ~900-char chunks on paragraph boundaries, keeps page refs.
export function chunkText(text: string, pageCount: number | null): { text: string; page_no: number | null }[] {
  const paras = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const chunks: { text: string; page_no: number | null }[] = [];
  let cur = "";
  for (const p of paras) {
    if ((cur + "\n\n" + p).length > 900 && cur) {
      chunks.push({ text: cur, page_no: null });
      cur = p;
    } else {
      cur = cur ? cur + "\n\n" + p : p;
    }
    if (chunks.length >= 400) break;
  }
  if (cur && chunks.length < 400) chunks.push({ text: cur, page_no: null });
  if (chunks.length === 0 && text.trim()) chunks.push({ text: text.slice(0, 900), page_no: null });
  // Distribute page numbers proportionally when known.
  if (pageCount && pageCount > 0 && chunks.length > 0) {
    chunks.forEach((c, i) => {
      c.page_no = Math.min(pageCount, Math.floor((i / chunks.length) * pageCount) + 1);
    });
  }
  return chunks;
}

// Idempotent: replaces prior extraction/chunks for the resource.
export async function persistExtraction(opts: {
  resourceId: string;
  courseId: string | null;
  ownerId: string;
  extracted: Extracted;
}) {
  const sb = createServiceClient();
  await sb.from("resource_extractions").delete().eq("resource_id", opts.resourceId);
  await sb.from("resource_chunks").delete().eq("resource_id", opts.resourceId);

  if (!opts.extracted.empty) {
    await sb.from("resource_extractions").insert({
      resource_id: opts.resourceId,
      owner_id: opts.ownerId,
      page_no: null,
      text: opts.extracted.text.slice(0, MAX_CHARS),
      chars: opts.extracted.text.length
    });
    const chunks = chunkText(opts.extracted.text, opts.extracted.pages);
    if (chunks.length > 0) {
      await sb.from("resource_chunks").insert(
        chunks.map((c, i) => ({
          resource_id: opts.resourceId,
          course_id: opts.courseId,
          owner_id: opts.ownerId,
          seq: i,
          page_no: c.page_no,
          text: c.text
        }))
      );
    }
  }

  await sb.from("resources").update({
    status: opts.extracted.empty ? "failed" : "ready"
  }).eq("id", opts.resourceId);
}

// Heuristic syllabus parse: Module/Unit/Chapter/Week headers -> modules,
// following bullets/numbered lines -> topics. Never invents modules.
export type SyllabusNode = { title: string; topics: string[] };

export function parseSyllabusStructure(text: string): { modules: SyllabusNode[]; warnings: string[] } {
  const warnings: string[] = [];
  const lines = text.split("\n").map((l) => l.trim()).filter((l) => l.length > 0 && l.length < 300);
  const headerRe = /^(module|unit|chapter|section|week|part)\s+(\d+[a-z]?)\s*[:\-–.)\]]?\s*(.+)?$/i;
  const modules: SyllabusNode[] = [];
  let current: SyllabusNode | null = null;

  for (const line of lines.slice(0, 2000)) {
    const m = line.match(headerRe);
    if (m) {
      const label = `${m[1][0].toUpperCase()}${m[1].slice(1)} ${m[2]}`;
      const rest = (m[3] ?? "").trim();
      current = { title: rest ? `${label} — ${rest}`.slice(0, 160) : label, topics: [] };
      modules.push(current);
      if (modules.length >= 30) break;
      continue;
    }
    if (current && current.topics.length < 40) {
      const topic = line.match(/^([\-•*▪‣]|\d+[.)]|[a-z][.)])\s+(.+)/);
      const t = (topic ? topic[2] : line).trim();
      if (t.length > 2 && t.length < 160 && !/^page \d+/i.test(t)) current.topics.push(t);
    }
  }

  if (modules.length === 0) warnings.push("No Module/Unit/Chapter headings detected; structure needs review.");
  if (modules.length === 1 && modules[0].topics.length === 0) warnings.push("Only one section found; check the syllabus format.");
  return { modules: modules.slice(0, 30), warnings };
}
