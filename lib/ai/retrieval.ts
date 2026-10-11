import "server-only";
import { createServiceClient } from "@/utils/supabase/service";

export type Passage = {
  chunk_id: string;
  resource_id: string;
  filename: string;
  page_no: number | null;
  excerpt: string;
};

// Keyword retrieval scoped to one course (+optional module/concept).
// Treats stored text as evidence, never instructions.
export async function retrieve(
  ownerId: string,
  courseId: string,
  query: string,
  limit = 8,
  resourceIds?: string[]
): Promise<Passage[]> {
  const sb = createServiceClient();
  const terms = query.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 2).slice(0, 12);
  if (terms.length === 0) return [];

  const or = terms.map((t) => `text.ilike.%${t.replace(/[%_]/g, "")}%`).join(",");
  let q = sb.from("resource_chunks").select("id,resource_id,text,page_no").eq("owner_id", ownerId).eq("course_id", courseId).or(or).limit(60);
  if (resourceIds && resourceIds.length > 0) q = q.in("resource_id", resourceIds.slice(0, 30));
  const { data, error } = await q;
  if (error || !data) return [];

  // Score by term hits, keep top N.
  const scored = (data as { id: string; resource_id: string; text: string; page_no: number | null }[]).map((c) => {
    const low = c.text.toLowerCase();
    let hits = 0;
    for (const t of terms) if (low.includes(t)) hits += 1;
    return { c, hits };
  }).filter((s) => s.hits > 0).sort((a, b) => b.hits - a.hits).slice(0, limit);

  // Fallback: scoped but term-mismatched queries still get the module's own
  // material (first chunks) rather than a false "no evidence".
  let pool = scored;
  if (pool.length === 0 && resourceIds && resourceIds.length > 0) {
    let fq = sb.from("resource_chunks").select("id,resource_id,text,page_no").eq("owner_id", ownerId).eq("course_id", courseId).in("resource_id", resourceIds.slice(0, 30)).order("seq").limit(limit);
    const { data: fdata } = await fq;
    pool = ((fdata ?? []) as { id: string; resource_id: string; text: string; page_no: number | null }[]).map((c) => ({ c, hits: 0 }));
  }

  if (pool.length === 0) return [];
  const resIds = Array.from(new Set(pool.map((s) => s.c.resource_id)));
  const { data: res } = await sb.from("resources").select("id,filename").in("id", resIds);
  const names = new Map(((res ?? []) as { id: string; filename: string }[]).map((r) => [r.id, r.filename]));

  return pool.map((s) => ({
    chunk_id: s.c.id,
    resource_id: s.c.resource_id,
    filename: names.get(s.c.resource_id) ?? "source",
    page_no: s.c.page_no,
    excerpt: s.c.text.slice(0, 600)
  }));
}

export function contextBlock(passages: Passage[]): string {
  return passages.map((p, i) => `[${i + 1}] ${p.filename}${p.page_no ? ` p.${p.page_no}` : ""}: ${p.excerpt}`).join("\n\n");
}

export function citationsOf(passages: Passage[]) {
  return passages.map((p, i) => ({ n: i + 1, resource_id: p.resource_id, filename: p.filename, page_no: p.page_no }));
}

// Resource ids assigned (suggested or confirmed) to a module.
export async function moduleResourceIds(moduleId: string, ownerId: string): Promise<string[]> {
  const sb = createServiceClient();
  const { data } = await sb.from("resource_module_assignments").select("resource_id").eq("module_id", moduleId).eq("owner_id", ownerId).limit(50);
  return ((data ?? []) as { resource_id: string }[]).map((r) => r.resource_id);
}
