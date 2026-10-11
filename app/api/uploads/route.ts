import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, RESOURCES_BUCKET } from "@/utils/supabase/service";
import { createClient } from "@/utils/supabase/server";
import { validateFile, safeName, kindOf, extOf } from "@/lib/uploads";

export const runtime = "nodejs";
export const maxDuration = 60;

type StoredFile = {
  path: string;
  name: string;
  size: number;
  mime: string;
  kind: string;
  url: string;
  createdAt: string;
  resourceId: string | null;
};

function err(code: string, message: string, status = 400) {
  return NextResponse.json({ error: { code, message } }, { status });
}

function cleanSegment(v: string | null, fallback: string) {
  const s = (v || fallback).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-").slice(0, 40);
  return s || fallback;
}

async function ownerPrefix(req: NextRequest, courseId: string) {
  // Authenticated uploads are namespaced per user so RLS-ready paths stay
  // stable; anonymous uploads (pre-sign-in wizard) use a shared prefix.
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) return { userId: user.id as string, courseId, prefix: `${user.id}/${courseId}` };
  } catch {
    // fall through to anonymous
  }
  return { userId: null as string | null, courseId, prefix: `anonymous/${courseId}` };
}

async function recordResource(row: {
  owner_id: string;
  course_id: string | null;
  storage_path: string;
  filename: string;
  mime: string;
  bytes: number;
  kind: string;
  scope: string;
}) {
  // Best-effort: resources table may not exist until migrations are pushed.
  try {
    const sb = createServiceClient();
    const { data } = await sb.from("resources").insert({ ...row, status: "stored" }).select("id").single();
    return (data as { id: string } | null)?.id ?? null;
  } catch {
    // storage remains source of truth; DB enriches later
    return null;
  }
}

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

async function ensureBucket(sb: ReturnType<typeof createServiceClient>) {
  const { data: buckets, error } = await sb.storage.listBuckets();
  if (error) throw new Error(`Storage unavailable: ${error.message}`);
  if (!buckets?.some((b) => b.name === RESOURCES_BUCKET)) {
    // Public bucket for MVP so uploads are immediately viewable + usable as
    // grounding source. Locked down with RLS/policies in the auth phase.
    const { error: cErr } = await sb.storage.createBucket(RESOURCES_BUCKET, { public: true });
    if (cErr) throw new Error(`Cannot create storage bucket: ${cErr.message}`);
  }
}

export async function POST(req: NextRequest) {
  let sb;
  try {
    sb = createServiceClient();
  } catch (e) {
    return err("not_configured", e instanceof Error ? e.message : "Storage not configured.", 500);
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return err("bad_request", "Expected multipart form-data with files.");
  }

  const scopeRaw = form.get("scope")?.toString();
  const scope = scopeRaw === "syllabus" ? "syllabus" : "resources";
  const courseSlug = cleanSegment(form.get("courseId")?.toString() ?? null, "general");
  const blobs = form.getAll("files").filter((f): f is File => f instanceof File);

  if (blobs.length === 0) return err("no_files", "Attach at least one file.");
  if (blobs.length > 20) return err("too_many", "Max 20 files per request.");

  const { userId, prefix } = await ownerPrefix(req, courseSlug);

  // Resolve course UUID ownership for the resources row (nullable otherwise).
  let courseUuid: string | null = null;
  if (userId && isUuid(courseSlug)) {
    try {
      const supabase = await createClient();
      const { data } = await supabase.from("courses").select("id").eq("id", courseSlug).eq("owner_id", userId).maybeSingle();
      if (data) courseUuid = (data as { id: string }).id;
    } catch {
      courseUuid = null;
    }
  }

  try {
    await ensureBucket(sb);
  } catch (e) {
    return err("bucket", e instanceof Error ? e.message : "Bucket error.", 500);
  }

  const stored: StoredFile[] = [];
  const failed: { name: string; message: string }[] = [];

  for (const f of blobs) {
    const problem = validateFile(f.name, f.size);
    if (problem) {
      failed.push({ name: f.name, message: problem });
      continue;
    }
    const name = safeName(f.name);
    const path = `${prefix}/${scope}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${name}`;
    const buf = Buffer.from(await f.arrayBuffer());
    const { error: upErr } = await sb.storage
      .from(RESOURCES_BUCKET)
      .upload(path, buf, { contentType: f.type || undefined, upsert: false });
    if (upErr) {
      failed.push({ name: f.name, message: upErr.message });
      continue;
    }
    const { data } = sb.storage.from(RESOURCES_BUCKET).getPublicUrl(path);
    const kind = kindOf(extOf(f.name), f.type);
    let resourceId: string | null = null;
    if (userId) {
      resourceId = await recordResource({
        owner_id: userId,
        course_id: courseUuid,
        storage_path: path,
        filename: f.name,
        mime: f.type || "application/octet-stream",
        bytes: f.size,
        kind,
        scope
      });
    }
    stored.push({
      path,
      name: f.name,
      size: f.size,
      mime: f.type || "application/octet-stream",
      kind,
      url: data.publicUrl,
      createdAt: new Date().toISOString(),
      resourceId
    });
  }

  if (stored.length === 0) {
    return NextResponse.json({ files: stored, failed }, { status: 422 });
  }
  return NextResponse.json({ files: stored, failed });
}

export async function GET(req: NextRequest) {
  let sb;
  try {
    sb = createServiceClient();
  } catch (e) {
    return err("not_configured", e instanceof Error ? e.message : "Storage not configured.", 500);
  }
  const { searchParams } = new URL(req.url);
  const scope = searchParams.get("scope") === "syllabus" ? "syllabus" : "resources";
  const courseSlug = cleanSegment(searchParams.get("courseId"), "general");

  try {
    await ensureBucket(sb);
  } catch (e) {
    return err("bucket", e instanceof Error ? e.message : "Bucket error.", 500);
  }

  const { userId, prefix } = await ownerPrefix(req, courseSlug);
  const prefixes = userId ? [prefix, `anonymous/${courseSlug}`] : [`anonymous/${courseSlug}`, "resources/general", "syllabus/general"];

  const seen = new Map<string, StoredFile>();
  for (const p of prefixes) {
    const { data, error } = await sb.storage.from(RESOURCES_BUCKET).list(p, { limit: 100, sortBy: { column: "created_at", order: "desc" } });
    if (error || !data) continue;
    for (const o of data) {
      if (o.id === null || o.name.endsWith("/")) continue;
      const path = `${p}/${o.name}`;
      if (seen.has(path)) continue;
      const { data: u } = sb.storage.from(RESOURCES_BUCKET).getPublicUrl(path);
      const meta = (o.metadata ?? {}) as { size?: number; mimetype?: string };
      seen.set(path, {
        path,
        name: o.name.includes("-") ? o.name.split("-").slice(2).join("-") || o.name : o.name,
        size: meta.size ?? 0,
        mime: meta.mimetype ?? "application/octet-stream",
        kind: kindOf(extOf(o.name)),
        url: u.publicUrl,
        createdAt: o.created_at ?? new Date().toISOString(),
        resourceId: null
      });
    }
  }

  const files = Array.from(seen.values())
    .filter((f) => (scope === "syllabus" ? f.path.includes("/syllabus/") : f.path.includes("/resources/")))
    .slice(0, 100);

  // Attach DB ids so the client can trigger processing per file.
  if (userId && files.length > 0) {
    try {
      const supabase = await createClient();
      const { data } = await supabase
        .from("resources")
        .select("id,storage_path")
        .eq("owner_id", userId)
        .in("storage_path", files.map((f) => f.path));
      const byPath = new Map(((data ?? []) as { id: string; storage_path: string }[]).map((r) => [r.storage_path, r.id]));
      for (const f of files) f.resourceId = byPath.get(f.path) ?? null;
    } catch {
      // storage list is still the source of truth
    }
  }

  return NextResponse.json({ files });
}

export async function DELETE(req: NextRequest) {
  let sb;
  try {
    sb = createServiceClient();
  } catch (e) {
    return err("not_configured", e instanceof Error ? e.message : "Storage not configured.", 500);
  }
  let body: { paths?: string[] };
  try {
    body = await req.json();
  } catch {
    return err("bad_request", "Expected JSON { paths: string[] }.");
  }
  const paths = (body.paths ?? []).filter((p) => typeof p === "string" && p.length > 0 && !p.includes("..")).slice(0, 20);
  if (paths.length === 0) return err("no_paths", "No valid paths supplied.");

  // Ownership: signed-in users may delete their own or pre-sign-in wizard
  // files; guests may only delete anonymous/legacy paths.
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const allowed = paths.filter((p) =>
      user ? p.startsWith(`${user.id}/`) || p.startsWith("anonymous/") || p.startsWith("resources/") || p.startsWith("syllabus/")
            : p.startsWith("anonymous/") || p.startsWith("resources/") || p.startsWith("syllabus/")
    );
    if (allowed.length === 0) return err("forbidden", "Not your file.", 403);
    const { error } = await sb.storage.from(RESOURCES_BUCKET).remove(allowed);
    if (error) return err("delete_failed", error.message, 500);
    return NextResponse.json({ removed: allowed });
  } catch (e) {
    if (e instanceof NextResponse) throw e;
    return err("delete_failed", e instanceof Error ? e.message : "Delete failed.", 500);
  }
}
