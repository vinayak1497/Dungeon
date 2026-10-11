import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/utils/supabase/service";
import { createClient } from "@/utils/supabase/server";
import { chatFor, aiStatus } from "@/lib/ai/providers";
import { coerceDoc, docText } from "@/lib/canvas/doc";
import { REFINE_MODES, REFINE_INSTRUCTIONS, type RefineMode } from "@/lib/ai/refine";

export const runtime = "nodejs";
export const maxDuration = 90;

function err(code: string, message: string, status = 400) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return err("unauthorized", "Sign in required.", 401);

  let body: { mode?: string; text?: string; pageId?: string };
  try {
    body = await req.json();
  } catch {
    return err("bad_request", "Expected JSON body.");
  }
  const mode = (body.mode ?? "") as RefineMode;
  if (!REFINE_MODES.includes(mode)) return err("bad_request", `mode must be one of ${REFINE_MODES.join(", ")}.`);
  const text = (body.text ?? "").trim();
  if (!text) return err("bad_request", "text required.");
  if (text.length > 8000) return err("bad_request", "Text too long (8000 char max).");

  if (!aiStatus().available) return err("no_provider", "AI is not configured (set Openrouter_AI or Groq_AI).", 503);

  // Optional page context — verified ownership before use.
  let contextNote = "";
  if (body.pageId) {
    const sb = createServiceClient();
    const { data: page } = await sb.from("canvas_pages").select("doc").eq("id", body.pageId).eq("owner_id", user.id).maybeSingle();
    if (page) {
      const pageText = docText(coerceDoc(page.doc));
      if (pageText.trim()) contextNote = pageText.slice(0, 2000);
    }
  }

  try {
    const { text: out, provider } = await chatFor("general", [
      {
        role: "system",
        content: `You edit a student's notes. Task: ${REFINE_INSTRUCTIONS[mode]} Preserve meaning and never add facts that are not present. Reply with ONLY a JSON object: {"refined":string,"note":string}. "note" is one short sentence describing what you changed.`
      },
      {
        role: "user",
        content: contextNote ? `Surrounding page context (reference only, do not merge):\n${contextNote}\n\nText to refine:\n${text}` : `Text to refine:\n${text}`
      }
    ], 1200);

    const clean = out.replace(/```json|```/g, "");
    const start = clean.indexOf("{");
    const end = clean.lastIndexOf("}");
    if (start === -1 || end === -1) throw new Error("Model returned no JSON.");
    const parsed = JSON.parse(clean.slice(start, end + 1)) as { refined?: string; note?: string };
    const refined = typeof parsed.refined === "string" ? parsed.refined.trim() : "";
    if (!refined) throw new Error("Empty refinement.");

    return NextResponse.json({
      refined: refined.slice(0, 8000),
      note: typeof parsed.note === "string" ? parsed.note.slice(0, 300) : REFINE_INSTRUCTIONS[mode],
      mode,
      provider
    });
  } catch (e) {
    return err("ai_failed", e instanceof Error ? e.message : "Refinement failed.", 502);
  }
}