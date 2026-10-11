import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/utils/supabase/service";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";

function err(code: string, message: string, status = 400) {
  return NextResponse.json({ error: { code, message } }, { status });
}

const NEXT: Record<string, string> = { again: "10 minutes", hard: "1 day", good: "3 days", easy: "7 days" };

// Records a self-graded review and schedules the next due date.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return err("unauthorized", "Sign in required.", 401);

  let body: { cardId?: string; grade?: string };
  try {
    body = await req.json();
  } catch {
    return err("bad_request", "Expected JSON { cardId, grade }.");
  }
  if (!body.cardId || !body.grade || !NEXT[body.grade]) return err("bad_request", "cardId and valid grade required.");

  const sb = createServiceClient();
  const { data: card } = await sb.from("flashcards").select("id,deck_id").eq("id", body.cardId).maybeSingle();
  if (!card) return err("not_found", "Card not found.", 404);
  const { data: deck } = await sb.from("flashcard_decks").select("id").eq("id", card.deck_id).eq("owner_id", user.id).maybeSingle();
  if (!deck) return err("forbidden", "Not your deck.", 403);

  const { error: rErr } = await sb.from("flashcard_reviews").insert({ card_id: card.id, owner_id: user.id, grade: body.grade });
  if (rErr) return err("write_failed", rErr.message, 500);
  await sb.from("flashcards").update({ due_at: new Date(Date.now() + ({ again: 6e5, hard: 864e5, good: 3 * 864e5, easy: 7 * 864e5 } as Record<string, number>)[body.grade]).toISOString() }).eq("id", card.id);

  return NextResponse.json({ ok: true, next: NEXT[body.grade] });
}
