import "server-only";
import { createClient } from "@supabase/supabase-js";

// Server-only privileged client. Never import from client components.
// Uses service-role (preferred) with secret-key fallback. Reads config at
// call time so missing env produces an actionable error, not a crash import.
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

  if (!url || !key) {
    throw new Error(
      "Supabase storage is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (see env.example)."
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

export const RESOURCES_BUCKET = "course-resources";
