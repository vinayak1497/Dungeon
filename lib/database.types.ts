// Minimal row types matching supabase/migrations/20261011000000_requiem_core.sql.
// Regenerate with `supabase gen types` once the project is linked.

export type Profile = {
  id: string;
  display_name: string | null;
  institution: string | null;
  degree: string | null;
  branch: string | null;
  semester: string | null;
  grad_year: string | null;
  portal_url: string | null;
  exam_date: string | null;
  daily_goal_min: number | null;
};

export type Course = {
  id: string;
  owner_id: string;
  title: string;
  code: string | null;
  semester: string | null;
  dept: string | null;
  exam_date: string | null;
  description: string | null;
  status: "draft" | "active" | "archived";
  created_at: string;
};

export type Module = {
  id: string;
  course_id: string;
  title: string;
  objective: string | null;
  position: number;
  status: "done" | "active" | "locked";
};

export type ResourceRow = {
  id: string;
  course_id: string | null;
  storage_path: string;
  filename: string;
  mime: string | null;
  bytes: number | null;
  kind: string | null;
  scope: "syllabus" | "resources";
  status: string;
};
