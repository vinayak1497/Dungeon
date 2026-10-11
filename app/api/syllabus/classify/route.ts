import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/utils/supabase/service";
import { createClient } from "@/utils/supabase/server";
import { chatFor, parseJsonResult } from "@/lib/ai/providers";
import { isSyllabusLike, scoreModules, confidenceFor } from "@/lib/ai/autoAssign";

export const runtime = "nodejs";
export const maxDuration = 120;

function err(code: string, message: string, status = 400) {
  return NextResponse.json({ error: { code, message } }, { status });
}

type Claim = { r: number; m: number; confidence: string };

// Automatic classification: each course PDF is filed into the syllabus or
// its best-fit module(s). Pipeline per run:
//   1. Backfill legacy rows (course_id NULL but stored under this course).
//   2. Syllabus pass (deterministic) — syllabus-like PDFs are promoted.
//   3. AI pass over remaining content (job-routed: Gemini → OpenRouter → Groq).
//   4. Keyword fallback for anything the AI leaves unmapped or on AI failure.
// Results are SUGGESTED assignments — the student confirms on mapping page.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return err("unauthorized", "Sign in required.", 401);

  let body: { courseId?: string };
  try {
    body = await req.json();
  } catch {
    return err("bad_request", "Expected JSON { courseId }.");
  }
  if (!body.courseId) return err("bad_request", "courseId required.");

  const sb = createServiceClient();
  const { data: course } = await sb.from("courses").select("id").eq("id", body.courseId).eq("owner_id", user.id).maybeSingle();
  if (!course) return err("not_found", "Course not found.", 404);

  // Backfill: rows stored under this course's prefix before course linking.
  await sb.from("resources")
    .update({ course_id: course.id })
    .eq("owner_id", user.id)
    .is("course_id", null)
    .like("storage_path", `%/${course.id}/%`);

  const [{ data: mods }, { data: resources }, { data: concepts }] = await Promise.all([
    sb.from("modules").select("id,title").eq("course_id", course.id).order("position"),
    sb.from("resources").select("id,filename,storage_path").eq("owner_id", user.id).eq("course_id", course.id).eq("scope", "resources").order("created_at", { ascending: true }).limit(30),
    sb.from("concepts").select("module_id,title").eq("course_id", course.id).limit(400)
  ]);
  const modules = (mods ?? []) as { id: string; title: string }[];
  const resList = (resources ?? []) as { id: string; filename: string; storage_path: string }[];
  if (modules.length === 0) return err("no_structure", "Extract syllabus structure first.", 422);
  if (resList.length === 0) return err("no_resources", "Upload PDFs first.", 422);

  const topicsByMod = new Map<string, string[]>();
  for (const c of ((concepts ?? []) as { module_id: string; title: string }[])) {
    const arr = topicsByMod.get(c.module_id) ?? [];
    if (arr.length < 40) arr.push(c.title);
    topicsByMod.set(c.module_id, arr);
  }
  const modShapes = modules.map((m) => ({ id: m.id, title: m.title, topics: topicsByMod.get(m.id) ?? [] }));

  // Sample content per resource (first chunks only — classification signal).
  const { data: chunks } = await sb.from("resource_chunks").select("resource_id,text,seq").in("resource_id", resList.map((r) => r.id)).order("seq").limit(600);
  const byRes = new Map<string, string>();
  for (const c of ((chunks ?? []) as { resource_id: string; text: string }[])) {
    const cur = byRes.get(c.resource_id) ?? "";
    if (cur.length < 6000) byRes.set(c.resource_id, `${cur}\n\n${c.text}`.slice(0, 6000));
  }

  // Pass 1 — syllabus promotion (deterministic, no AI needed).
  const syllabus: { resource_id: string; filename: string }[] = [];
  let remaining = resList;
  if (remaining.length > 0) {
    const promoted: string[] = [];
    for (const r of remaining) {
      if (isSyllabusLike(r.filename, byRes.get(r.id) ?? "")) {
        await sb.from("resources").update({ scope: "syllabus" }).eq("id", r.id).eq("owner_id", user.id);
        syllabus.push({ resource_id: r.id, filename: r.filename });
        promoted.push(r.id);
      }
    }
    if (promoted.length > 0) remaining = remaining.filter((r) => !promoted.includes(r.id));
  }
  if (remaining.length === 0) {
    return NextResponse.json({ assignments: [], autoAssigned: [], syllabus, unmapped: [] });
  }

  // Pass 2 — AI classification over remaining content.
  const modLines = modules.map((m, i) => `M${i + 1} = ${m.title}`).join("\n");
  const resLines = remaining.map((r, i) => {
    const sample = (byRes.get(r.id) ?? "").slice(0, 1500) || "(no extracted text — use filename only)";
    return `R${i + 1} = ${r.filename}\nExcerpt: ${sample}`;
  }).join("\n\n");

  let claims: Claim[] = [];
  let aiOk = true;
  try {
    const { text, provider } = await chatFor("classify", [
      {
        role: "system",
        content: "Classify study resources into syllabus modules by content. Reply with ONLY JSON: {\"assignments\":[{\"r\":number,\"m\":number,\"confidence\":\"high\"|\"medium\"|\"low\"}]}. Use R/M numbers exactly as listed. A resource may map to multiple modules; omit resources with no topical fit. Base decisions on excerpts, not filenames alone."
      },
      { role: "user", content: `Modules:\n${modLines}\n\nResources:\n${resLines}`.slice(0, 20000) }
    ], 2000);
    const parsed = parseJsonResult<{ assignments: Claim[] }>(text);
    if (!Array.isArray(parsed.assignments)) throw new Error("bad shape");
    claims = parsed.assignments;
    void provider;
  } catch {
    aiOk = false;
  }

  const valid = claims.filter((c) =>
    Number.isInteger(c.r) && Number.isInteger(c.m) && c.r >= 1 && c.r <= remaining.length && c.m >= 1 && c.m <= modules.length
  );
  const modIds = modules.map((m) => m.id);
  await sb.from("resource_module_assignments").delete().in("module_id", modIds).eq("state", "suggested");
  const rows = valid.map((c) => ({
    resource_id: remaining[c.r - 1].id,
    module_id: modules[c.m - 1].id,
    owner_id: user.id,
    confidence: (c.confidence === "high" || c.confidence === "medium" ? c.confidence : "review") as string,
    state: "suggested" as const
  }));
  const seen = new Set<string>();
  const unique = rows.filter((r) => {
    const k = `${r.resource_id}:${r.module_id}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  if (unique.length > 0) await sb.from("resource_module_assignments").insert(unique);

  // Pass 3 — deterministic keyword fallback for anything still unmapped
  // (also covers total AI failure: no PDF is left behind when it matches).
  const mapped = new Set(unique.map((u) => u.resource_id));
  const autoAssigned: { resource_id: string; filename: string; module_id: string; module_title: string; confidence: string }[] = [];
  for (const r of remaining.filter((x) => !mapped.has(x.id))) {
    const scored = scoreModules(byRes.get(r.id) ?? "", r.filename, modShapes);
    const best = scored[0];
    if (!best || best.score < 3) continue;
    const confidence = confidenceFor(best.score);
    const mod = modules.find((m) => m.id === best.moduleId);
    if (!mod) continue;
    await sb.from("resource_module_assignments").insert({
      resource_id: r.id,
      module_id: best.moduleId,
      owner_id: user.id,
      confidence,
      state: "suggested"
    });
    mapped.add(r.id);
    autoAssigned.push({ resource_id: r.id, filename: r.filename, module_id: best.moduleId, module_title: mod.title, confidence });
  }

  return NextResponse.json({
    assignments: unique.map((u) => ({
      resource_id: u.resource_id,
      filename: remaining.find((r) => r.id === u.resource_id)?.filename ?? "",
      module_id: u.module_id,
      module_title: modules.find((m) => m.id === u.module_id)?.title ?? "",
      confidence: u.confidence
    })),
    autoAssigned,
    aiFallback: !aiOk,
    syllabus,
    unmapped: remaining.filter((r) => !mapped.has(r.id)).map((r) => ({ resource_id: r.id, filename: r.filename }))
  });
}
