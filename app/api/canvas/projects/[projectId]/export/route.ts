import { NextResponse } from "next/server";
import { createServiceClient } from "@/utils/supabase/service";
import { createClient } from "@/utils/supabase/server";
import { coerceDoc } from "@/lib/canvas/doc";

export const runtime = "nodejs";

/** All pages of an owned project, in persisted order — used by PDF export. */
export async function GET(_req: Request, { params }: { params: { projectId: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: { code: "unauthorized", message: "Sign in required." } }, { status: 401 });

  const sb = createServiceClient();
  const { data: project } = await sb
    .from("canvas_projects")
    .select("id,title")
    .eq("id", params.projectId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!project) return NextResponse.json({ error: { code: "not_found", message: "Canvas not found." } }, { status: 404 });

  const { data: pages } = await sb
    .from("canvas_pages")
    .select("id,title,doc")
    .eq("project_id", project.id)
    .eq("owner_id", user.id)
    .order("position");

  return NextResponse.json({
    project,
    pages: (pages ?? []).map((p) => {
      const doc = coerceDoc(p.doc);
      return {
        id: p.id,
        title: p.title,
        elements: doc.elements,
        strokes: doc.strokes ?? [],
        shapes: doc.shapes ?? []
      };
    })
  });
}