import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/utils/supabase/service";
import { createClient } from "@/utils/supabase/server";
import { aiChat, aiStatus } from "@/lib/ai/providers";
import { retrieve, contextBlock, citationsOf, moduleResourceIds } from "@/lib/ai/retrieval";

export const runtime = "nodejs";
export const maxDuration = 60;

function err(code: string, message: string, status = 400) {
  return NextResponse.json({ error: { code, message } }, { status });
}

// Grounded Q&A: retrieves authorized course chunks, answers with citations,
// or returns explicit insufficient-information (never fabricates).
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return err("unauthorized", "Sign in required.", 401);

  let body: { courseId?: string; question?: string; concept?: string; moduleId?: string };
  try {
    body = await req.json();
  } catch {
    return err("bad_request", "Expected JSON { courseId, question }.");
  }
  const question = (body.question ?? "").trim().slice(0, 1000);
  if (!body.courseId || !question) return err("bad_request", "courseId and question required.");

  const sb = createServiceClient();
  const { data: course } = await sb.from("courses").select("id").eq("id", body.courseId).eq("owner_id", user.id).maybeSingle();
  if (!course) return err("not_found", "Course not found.", 404);

  let moduleTitle: string | null = null;
  let scopeIds: string[] | undefined;
  if (body.moduleId) {
    const { data: mod } = await sb.from("modules").select("id,title,course_id").eq("id", body.moduleId).eq("owner_id", user.id).maybeSingle();
    if (mod && mod.course_id === body.courseId) {
      moduleTitle = mod.title;
      scopeIds = await moduleResourceIds(mod.id, user.id);
    }
  }

  const query = body.concept ?? moduleTitle ? `${body.concept ?? moduleTitle} ${question}` : question;
  const passages = await retrieve(user.id, body.courseId, query, 8, scopeIds);

  if (passages.length === 0) {
    return NextResponse.json({
      grounded: false,
      status: "insufficient",
      answer: null,
      message: "Your uploads don't cover this yet. Broaden the scope, check the original documents, or ask for a general explanation (labeled as external knowledge).",
      citations: []
    });
  }

  if (!aiStatus().available) {
    return NextResponse.json({
      grounded: false,
      status: "no_provider",
      answer: null,
      message: "AI is not configured (set Openrouter_AI or Groq_AI). Relevant sources found below.",
      citations: citationsOf(passages)
    });
  }

  try {
    const { text, provider } = await aiChat([
      {
        role: "system",
        content: "Answer ONLY from the provided sources. Cite claims as [1], [2] matching source order. If sources don't support the answer, say INSUFFICIENT and stop. Never invent page numbers or facts. Keep answers concise."
      },
      { role: "user", content: `Sources:\n${contextBlock(passages)}\n\nQuestion: ${question}` }
    ], 1000);
    if (/INSUFFICIENT/i.test(text.slice(0, 200))) {
      return NextResponse.json({ grounded: false, status: "insufficient", answer: text, citations: citationsOf(passages), provider });
    }
    return NextResponse.json({ grounded: true, status: "answered", answer: text, citations: citationsOf(passages), provider });
  } catch (e) {
    return err("ai_failed", e instanceof Error ? e.message : "AI failed.", 502);
  }
}
