import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/utils/supabase/service";
import { createClient } from "@/utils/supabase/server";
import { chatFor, parseJsonResult } from "@/lib/ai/providers";
import { retrieve, contextBlock, moduleResourceIds } from "@/lib/ai/retrieval";

export const runtime = "nodejs";
export const maxDuration = 120;

function err(code: string, message: string, status = 400) {
  return NextResponse.json({ error: { code, message } }, { status });
}

// Generates a grounded deck from the student's chunks. No chunks → 422.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return err("unauthorized", "Sign in required.", 401);

  let body: { courseId?: string; concept?: string; moduleId?: string; count?: number };
  try {
    body = await req.json();
  } catch {
    return err("bad_request", "Expected JSON body.");
  }
  if (!body.courseId) return err("bad_request", "courseId required.");
  const count = Math.min(20, Math.max(5, body.count ?? 12));

  const sb = createServiceClient();
  const { data: course } = await sb.from("courses").select("id,title").eq("id", body.courseId).eq("owner_id", user.id).maybeSingle();
  if (!course) return err("not_found", "Course not found.", 404);

  let moduleTitle: string | null = null;
  let scopeIds: string[] | undefined;
  if (body.moduleId) {
    const { data: mod } = await sb.from("modules").select("id,title,course_id").eq("id", body.moduleId).eq("owner_id", user.id).maybeSingle();
    if (!mod || mod.course_id !== course.id) return err("bad_request", "Module not in this course.", 400);
    moduleTitle = mod.title;
    scopeIds = await moduleResourceIds(mod.id, user.id);
  }

  const passages = await retrieve(user.id, body.courseId, body.concept ?? moduleTitle ?? course.title, 10, scopeIds);
  if (passages.length === 0) return err("no_evidence", "Upload and process study material first.", 422);

  let cards: { front: string; back: string }[] | null = null;
  try {
    const { text } = await chatFor("general", [
      {
        role: "system",
        content: `Write ${count} concise flashcards from these sources. Reply ONLY JSON: {"cards":[{"front":string,"back":string}]}. Front = question/cue, back = short answer. No duplicates.`
      },
      { role: "user", content: contextBlock(passages).slice(0, 12000) }
    ], 2000);
    const parsed = parseJsonResult<{ cards: { front: string; back: string }[] }>(text);
    if (!Array.isArray(parsed.cards) || parsed.cards.length === 0) throw new Error("empty");
    cards = parsed.cards.slice(0, count).map((c) => ({ front: String(c.front).slice(0, 300), back: String(c.back).slice(0, 500) }));
  } catch (e) {
    return err("ai_failed", e instanceof Error ? e.message : "Generation failed.", 502);
  }

  const { data: deck, error: dErr } = await sb.from("flashcard_decks").insert({
    course_id: course.id, owner_id: user.id, title: `${body.concept ?? moduleTitle ?? course.title} — deck`
  }).select("id").single();
  if (dErr || !deck) return err("write_failed", dErr?.message ?? "Save failed.", 500);
  const { error: cErr } = await sb.from("flashcards").insert(cards!.map((c) => ({ deck_id: deck.id, front: c.front, back: c.back })));
  if (cErr) return err("write_failed", cErr.message, 500);

  return NextResponse.json({ deckId: deck.id, count: cards!.length }, { status: 201 });
}
