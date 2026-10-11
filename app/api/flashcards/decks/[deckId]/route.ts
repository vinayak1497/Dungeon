import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createServiceClient } from "@/utils/supabase/service";

export const runtime = "nodejs";

function err(code: string, message: string, status = 400) {
  return NextResponse.json({ error: { code, message } }, { status });
}

// Returns one owned deck with its cards (front/back/due). Ownership is
// checked via the parent deck — cards inherit access server-side.
export async function GET(_req: NextRequest, { params }: { params: { deckId: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return err("unauthorized", "Sign in required.", 401);

  const sb = createServiceClient();
  const { data: deck } = await sb
    .from("flashcard_decks")
    .select("id,title,course_id,created_at")
    .eq("id", params.deckId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!deck) return err("not_found", "Deck not found.", 404);

  const { data: cards, error } = await sb
    .from("flashcards")
    .select("id,front,back,due_at")
    .eq("deck_id", deck.id)
    .order("due_at", { ascending: true })
    .limit(200);
  if (error) return err("read_failed", error.message, 500);

  return NextResponse.json({ deck, cards: cards ?? [] });
}
