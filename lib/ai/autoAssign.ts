import "server-only";
import { createServiceClient } from "@/utils/supabase/service";
import { parseSyllabusStructure } from "@/lib/ingest";

export type ModuleShape = { id: string; title: string; topics: string[] };

const STOP = new Set([
  "the", "and", "for", "with", "from", "that", "this", "are", "was", "were",
  "will", "shall", "module", "unit", "chapter", "week", "part", "section",
  "introduction", "overview", "study", "course", "topic", "topics"
]);

export function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2 && !STOP.has(t))
    .slice(0, 400);
}

const SYLLABUS_SIGNALS = [
  "syllabus", "instructor", "office hours", "grading", "grade breakdown",
  "prerequisites", "course objectives", "learning outcomes", "schedule",
  "academic integrity", "attendance policy", "required textbook"
];

/**
 * Conservative syllabus detector. A content PDF is never promoted on a
 * single weak signal — filename hit wins, otherwise parsed structure +
 * at least two syllabus phrases must agree.
 */
export function isSyllabusLike(filename: string, text: string): boolean {
  if (/syllab/i.test(filename)) return true;
  if (!text.trim()) return false;
  const head = text.slice(0, 8000).toLowerCase();
  const signals = SYLLABUS_SIGNALS.filter((s) => head.includes(s)).length;
  if (signals >= 4) return true;
  const { modules } = parseSyllabusStructure(text.slice(0, 12000));
  if (modules.length >= 3 && signals >= 2) return true;
  if (modules.length >= 2 && signals >= 3) return true;
  return false;
}

export function scoreModules(
  resourceText: string,
  filename: string,
  modules: ModuleShape[]
): { moduleId: string; score: number; filenameHits: number }[] {
  const body = resourceText.slice(0, 12000).toLowerCase();
  const fileToks = new Set(tokens(filename));
  return modules
    .map((m) => {
      const terms = Array.from(new Set(tokens(`${m.title} ${m.topics.join(" ")}`)));
      if (terms.length === 0) return { moduleId: m.id, score: 0, filenameHits: 0 };
      let hits = 0;
      let fileHits = 0;
      for (const t of terms) {
        if (body.includes(t)) hits += 1;
        if (fileToks.has(t)) fileHits += 1;
      }
      return { moduleId: m.id, score: hits + fileHits * 3, filenameHits: fileHits };
    })
    .sort((a, b) => b.score - a.score);
}

export function confidenceFor(score: number): "high" | "medium" | "review" {
  if (score >= 10) return "high";
  if (score >= 5) return "medium";
  return "review";
}

async function courseModules(ownerId: string, courseId: string): Promise<ModuleShape[]> {
  const sb = createServiceClient();
  const { data: mods } = await sb.from("modules").select("id,title").eq("course_id", courseId).order("position");
  const list = ((mods ?? []) as { id: string; title: string }[]);
  if (list.length === 0) return [];
  const { data: concepts } = await sb.from("concepts").select("module_id,title").eq("course_id", courseId).limit(400);
  const byMod = new Map<string, string[]>();
  for (const c of ((concepts ?? []) as { module_id: string; title: string }[])) {
    const arr = byMod.get(c.module_id) ?? [];
    if (arr.length < 40) arr.push(c.title);
    byMod.set(c.module_id, arr);
  }
  return list.map((m) => ({ id: m.id, title: m.title, topics: byMod.get(m.id) ?? [] }));
}

async function resourceText(ownerId: string, resourceId: string, limit = 12000): Promise<{ filename: string; text: string }> {
  const sb = createServiceClient();
  const { data: res } = await sb.from("resources").select("filename").eq("id", resourceId).eq("owner_id", ownerId).maybeSingle();
  const filename = (res as { filename?: string } | null)?.filename ?? "";
  const { data: chunks } = await sb.from("resource_chunks").select("text").eq("resource_id", resourceId).order("seq").limit(20);
  const text = (((chunks ?? []) as { text: string }[]).map((c) => c.text).join("\n\n")).slice(0, limit);
  return { filename, text };
}

export type AutoAssignResult =
  | { status: "syllabus"; filename: string }
  | { status: "assigned"; moduleId: string; confidence: string; score: number }
  | { status: "no_match"; bestScore: number }
  | { status: "no_structure" }
  | { status: "skipped"; reason: string };

/**
 * Classifies ONE resource without any AI call: syllabus promotion first,
 * then deterministic keyword scoring against this course's modules.
 * Safe to run after every ingest — only writes `suggested` rows and never
 * touches `confirmed` assignments.
 */
export async function autoAssignResource(
  ownerId: string,
  courseId: string,
  resourceId: string
): Promise<AutoAssignResult> {
  const sb = createServiceClient();
  const { data: res } = await sb
    .from("resources")
    .select("id,filename,scope,course_id")
    .eq("id", resourceId)
    .eq("owner_id", ownerId)
    .maybeSingle();
  const row = res as { id: string; filename: string; scope: string; course_id: string | null } | null;
  if (!row) return { status: "skipped", reason: "not_found" };
  if (row.course_id !== courseId) return { status: "skipped", reason: "other_course" };
  if (row.scope === "syllabus") return { status: "skipped", reason: "is_syllabus" };

  const modules = await courseModules(ownerId, courseId);
  if (modules.length === 0) return { status: "no_structure" };

  const { filename, text } = await resourceText(ownerId, resourceId);
  if (isSyllabusLike(filename || row.filename, text)) {
    await sb.from("resources").update({ scope: "syllabus" }).eq("id", resourceId).eq("owner_id", ownerId);
    return { status: "syllabus", filename: filename || row.filename };
  }

  // Filename-only resources (scanned PDFs, slides) still get a shot.
  const scored = scoreModules(text, filename || row.filename, modules);
  const best = scored[0];
  if (!best || best.score < 3) return { status: "no_match", bestScore: best?.score ?? 0 };

  const confidence = confidenceFor(best.score);
  await sb.from("resource_module_assignments").delete().eq("resource_id", resourceId).eq("state", "suggested");
  await sb.from("resource_module_assignments").insert({
    resource_id: resourceId,
    module_id: best.moduleId,
    owner_id: ownerId,
    confidence,
    state: "suggested"
  });
  return { status: "assigned", moduleId: best.moduleId, confidence, score: best.score };
}
