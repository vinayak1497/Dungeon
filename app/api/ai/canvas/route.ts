import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/utils/supabase/service";
import { createClient } from "@/utils/supabase/server";
import { chatFor, aiStatus } from "@/lib/ai/providers";
import { retrieve, contextBlock, citationsOf } from "@/lib/ai/retrieval";
import { coerceDoc, docText, type Doc } from "@/lib/canvas/doc";

export const runtime = "nodejs";
export const maxDuration = 90;

function err(code: string, message: string, status = 400) {
  return NextResponse.json({ error: { code, message } }, { status });
}

const MAX_NOTE_CHARS = 12000;

type Built = { notes: string; sources: string; citations: ReturnType<typeof citationsOf> };

/**
 * Canvas-aware context. Notes (canvas pages/selection) and sources (uploaded
 * course chunks) are kept visibly separate so the model never confuses them.
 */
async function buildContext(opts: {
  userId: string;
  scope: "selection" | "page" | "project" | "course";
  projectId: string | null;
  pageId: string | null;
  selection: string;
  courseId: string | null;
}): Promise<Built> {
  const sb = createServiceClient();
  const cid = opts.userId;
  let notes = "";

  if (opts.scope === "selection") {
    notes = opts.selection.slice(0, MAX_NOTE_CHARS);
  } else if (opts.scope === "page" && opts.pageId) {
    const { data } = await sb.from("canvas_pages").select("title,doc").eq("id", opts.pageId).eq("owner_id", cid).maybeSingle();
    if (data) notes = `## Page: ${data.title}\n${docText(coerceDoc(data.doc))}`.slice(0, MAX_NOTE_CHARS);
  } else if (opts.scope === "project" && opts.projectId) {
    // Verify project ownership, then load every page in persisted order.
    const { data: proj } = await sb.from("canvas_projects").select("id").eq("id", opts.projectId).eq("owner_id", cid).maybeSingle();
    if (!proj) return { notes: "", sources: "", citations: [] };
    const { data: pages } = await sb
      .from("canvas_pages")
      .select("title,doc")
      .eq("project_id", opts.projectId)
      .eq("owner_id", cid)
      .order("position")
      .limit(40);
    notes = (pages ?? [])
      .map((p, i) => `## Page ${i + 1}: ${p.title}\n${docText(coerceDoc(p.doc)) || "(empty page)"}`)
      .join("\n\n")
      .slice(0, MAX_NOTE_CHARS);
  }

  // Course scope (or supporting material for note scopes).
  let sources = "";
  let citations: ReturnType<typeof citationsOf> = [];
  if (opts.courseId) {
    const { data: course } = await sb.from("courses").select("id,title").eq("id", opts.courseId).eq("owner_id", cid).maybeSingle();
    if (course) {
      const passages = await retrieve(cid, course.id, opts.selection || course.title, 6);
      if (passages.length > 0) {
        sources = contextBlock(passages);
        citations = citationsOf(passages);
      }
    }
  }
  return { notes, sources, citations };
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return err("unauthorized", "Sign in required.", 401);

  let body: { scope?: string; projectId?: string | null; pageId?: string | null; selection?: string; courseId?: string | null; question?: string };
  try {
    body = await req.json();
  } catch {
    return err("bad_request", "Expected JSON body.");
  }
  const scope = (body.scope ?? "page") as "selection" | "page" | "project" | "course";
  const question = (body.question ?? "").trim().slice(0, 1200);
  if (!question) return err("bad_request", "question required.");
  if (scope === "project" && !body.projectId) return err("bad_request", "projectId required for project scope.");
  if (scope === "page" && !body.pageId) return err("bad_request", "pageId required for page scope.");

  const ctx = await buildContext({
    userId: user.id,
    scope,
    projectId: body.projectId ?? null,
    pageId: body.pageId ?? null,
    selection: (body.selection ?? "").trim(),
    courseId: body.courseId ?? null
  });

  const hasNotes = ctx.notes.trim().length > 0;
  const hasSources = ctx.sources.trim().length > 0;
  if (!hasNotes && !hasSources) {
    return NextResponse.json({
      grounded: false,
      status: "insufficient",
      message:
        scope === "selection"
          ? "Select some note text first — nothing is selected on this page."
          : scope === "project"
            ? "This canvas project has no saved notes yet."
            : scope === "page"
              ? "This page has no notes yet."
              : "No course material is attached to this canvas yet.",
      citations: []
    });
  }
  if (!aiStatus().available) {
    return NextResponse.json({ grounded: false, status: "no_provider", message: "AI is not configured. Relevant context is listed below.", notes: ctx.notes.slice(0, 800), citations: ctx.citations });
  }

  const blocks = [
    hasNotes ? `=== MY CANVAS NOTES (${scope}) ===\n${ctx.notes}` : "",
    hasSources ? `=== COURSE SOURCE EXCERPTS ===\n${ctx.sources}` : ""
  ].filter(Boolean).join("\n\n");

  const evidenceRule = hasNotes && hasSources
    ? "Treat canvas notes and course excerpts as distinct evidence. Prefer notes when they are specific; otherwise cite excerpts."
    : hasNotes
      ? "Answer ONLY from my canvas notes. Cite them as [N]."
      : "Answer ONLY from the course excerpts. Cite them as [N].";

  try {
    const { text, provider } = await chatFor("general", [
      {
        role: "system",
        content: `You assist with a student's study canvas. ${evidenceRule} Never invent facts, formulas or citations. If the evidence does not support an answer, reply exactly: INSUFFICIENT. Keep answers concise and useful for revision.`
      },
      { role: "user", content: `${blocks}\n\nTask: ${question}` }
    ], 1200);

    if (/^\s*INSUFFICIENT/i.test(text)) {
      return NextResponse.json({ grounded: false, status: "insufficient", message: text.slice(0, 400), citations: ctx.citations, provider });
    }
    return NextResponse.json({ grounded: true, status: "answered", answer: text, citations: ctx.citations, scope, provider });
  } catch (e) {
    return err("ai_failed", e instanceof Error ? e.message : "AI failed.", 502);
  }
}

export type { Doc };