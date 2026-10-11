import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 30;

type Video = {
  id: string;
  title: string;
  channel: string;
  thumbnail: string;
  duration: string | null;
  durationSeconds: number | null;
  publishedAt: string | null;
  relevance: number;
  url: string;
};

/** Accepts the name variants used across .env files and trims stray spaces. */
function youtubeKey(): string {
  const raw =
    process.env.YOUTUBE_API_KEY ??
    process.env.Youtube_API ??
    process.env.YOUTUBE_KEY ??
    process.env.YT_API_KEY ??
    "";
  return raw.trim();
}

function parseDuration(iso: string | undefined): { text: string | null; seconds: number | null } {
  if (!iso) return { text: null, seconds: null };
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso);
  if (!m) return { text: null, seconds: null };
  const s = +(m[1] ?? 0) * 86400 + +(m[2] ?? 0) * 3600 + +(m[3] ?? 0) * 60 + +(m[4] ?? 0);
  if (!Number.isFinite(s)) return { text: null, seconds: null };
  const h = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const text = h > 0 ? `${h}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}` : `${mm}:${String(ss).padStart(2, "0")}`;
  return { text, seconds: s };
}

const STOP = new Set([
  "the", "and", "for", "with", "from", "that", "this", "into", "what", "when", "how", "why", "are", "was",
  "about", "video", "videos", "lecture", "tutorial", "explained", "explain", "learn", "study", "notes", "part"
]);

/** Explainable relevance: title/description term hits, recency, duration sanity. */
function score(v: { title: string; description: string; publishedAt: string | null; seconds: number | null }, terms: string[]): number {
  const title = v.title.toLowerCase();
  const desc = v.description.toLowerCase();
  let s = 0;
  const hit = new Set<string>();
  for (const t of terms) {
    if (title.includes(t)) { s += 3; hit.add(t); }
    else if (desc.includes(t)) { s += 1; hit.add(t); }
  }
  if (terms.length > 0) s += (hit.size / terms.length) * 2;
  if (v.publishedAt) {
    const ageYears = (Date.now() - new Date(v.publishedAt).getTime()) / (365 * 864e5);
    if (Number.isFinite(ageYears)) s += Math.max(0, 2 - ageYears * 0.5);
  }
  if (v.seconds !== null) {
    if (v.seconds < 90) s -= 2;
    if (v.seconds > 3600) s -= 1;
  }
  return s;
}

// Real YouTube Data API v3 search, server-side only. Honest unavailable state
// when the key is missing/invalid, quota is hit, or nothing matches — never fake rows.
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: { code: "unauthorized", message: "Sign in required." } }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const concept = (searchParams.get("concept") ?? "").trim().slice(0, 120);
  const context = (searchParams.get("context") ?? "").trim().slice(0, 120);
  if (!concept) return NextResponse.json({ error: { code: "bad_request", message: "concept required." } }, { status: 400 });

  const key = youtubeKey();
  if (!key) {
    return NextResponse.json({ unavailable: true, reason: "YouTube API key not found. Add YOUTUBE_API_KEY (or Youtube_API) to .env.local and restart the server.", videos: [] });
  }

  const terms = `${concept} ${context}`
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2 && !STOP.has(t))
    .slice(0, 10);

  try {
    const q = encodeURIComponent(`${concept} ${context}`.trim());
    const sRes = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoEmbeddable=true&maxResults=12&order=relevance&q=${q}&key=${encodeURIComponent(key)}`
    );

    if (sRes.status === 400 || sRes.status === 403) {
      const detail = (await sRes.json().catch(() => ({}))) as { error?: { message?: string } };
      return NextResponse.json({
        unavailable: true,
        reason: `YouTube key not usable: ${detail.error?.message ?? `HTTP ${sRes.status}`}`,
        videos: []
      });
    }
    if (!sRes.ok) throw new Error(`YouTube search ${sRes.status}`);

    const sJson = (await sRes.json()) as { items?: { id?: { videoId?: string }; snippet?: { description?: string } }[] };
    const descById = new Map<string, string>();
    const ids: string[] = [];
    for (const item of sJson.items ?? []) {
      const vid = item?.id?.videoId;
      if (!vid) continue;
      ids.push(vid);
      descById.set(vid, item.snippet?.description ?? "");
    }
    if (ids.length === 0) return NextResponse.json({ videos: [] as Video[] });

    const vRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${ids.join(",")}&key=${encodeURIComponent(key)}`);
    const vJson = vRes.ok ? ((await vRes.json()) as { items?: unknown[] }) : { items: [] };

    const videos: Video[] = (vJson.items ?? [])
      .map((raw) => {
        const v = raw as {
          id: string;
          snippet: {
            title: string;
            channelTitle: string;
            description?: string;
            publishedAt?: string;
            thumbnails?: { medium?: { url?: string }; high?: { url?: string } };
          };
          contentDetails?: { duration?: string };
        };
        const dur = parseDuration(v.contentDetails?.duration);
        return {
          id: v.id,
          title: v.snippet.title,
          channel: v.snippet.channelTitle,
          thumbnail: v.snippet.thumbnails?.high?.url ?? v.snippet.thumbnails?.medium?.url ?? "",
          duration: dur.text,
          durationSeconds: dur.seconds,
          publishedAt: v.snippet.publishedAt ?? null,
          description: v.snippet.description ?? descById.get(v.id) ?? "",
          relevance: 0,
          url: `https://www.youtube.com/watch?v=${v.id}`
        };
      })
      .map((v) => ({ ...v, relevance: Number(score({ title: v.title, description: v.description, publishedAt: v.publishedAt, seconds: v.durationSeconds }, terms).toFixed(2)) }))
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, 6);

    return NextResponse.json({ videos, query: q, terms });
  } catch (e) {
    return NextResponse.json({ unavailable: true, reason: e instanceof Error ? e.message : "Video search failed.", videos: [] });
  }
}