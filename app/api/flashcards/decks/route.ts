import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createServiceClient } from "@/utils/supabase/service";

export const runtime = "nodejs";

function err(code: string, message: string, status = 400) {
  return NextResponse.json({ error: { code, message } }, { status });
}

// Lists the student's own flashcard decks (optionally filtered by course)
// with card counts + due counts. Cards themselves load via [deckId].
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return err("unauthorized", "Sign in required.", 401);

  const courseId = new URL(req.url).searchParams.get("courseId");

  const sb = createServiceClient();
  let q = sb
    .from("flashcard_decks")
    .select("id,title,course_id,created_at")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);
  if (courseId) q = q.eq("course_id", courseId);
  const { data: decks, error } = await q;
  if (error) return err("read_failed", error.message, 500);

  const ids = (decks ?? []).map((d) => d.id as string);
  const counts: Record<string, { cards: number; due: number }> = {};
  for (const id of ids) counts[id] = { cards: 0, due: 0 };
  if (ids.length > 0) {
    const { data: cards } = await sb
      .from("flashcards")
      .select("deck_id,due_at")
      .in("deck_id", ids)
      .limit(2000);
    const now = new Date().toISOString();
    for (const c of (cards ?? []) as { deck_id: string; due_at: string | null }[]) {
      const slot = counts[c.deck_id];
      if (!slot) continue;
      slot.cards += 1;
      if (!c.due_at || c.due_at <= now) slot.due += 1;
    }
  }

  return NextResponse.json({
    decks: (decks ?? []).map((d) => ({ ...d, cards: counts[d.id]?.cards ?? 0, due: counts[d.id]?.due ?? 0 }))
  });
}
