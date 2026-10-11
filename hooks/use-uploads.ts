"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { validateFile } from "@/lib/uploads";

export type StoredFile = {
  path: string;
  name: string;
  size: number;
  mime: string;
  kind: string;
  url: string;
  createdAt: string;
  resourceId?: string | null;
};

export type FailedFile = { name: string; message: string };

// Real upload state against /api/uploads (Supabase Storage). No demo data.
export function useUploads(scope: "syllabus" | "resources", courseId = "general") {
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [failed, setFailed] = useState<FailedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [dragOver, setDragOver] = useState(false);
  const active = useRef(0);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/uploads?scope=${scope}&courseId=${courseId}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? "List failed.");
      setFiles(json.files ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "List failed.");
    } finally {
      setLoading(false);
    }
  }, [scope, courseId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const uploadMany = useCallback(
    async (picked: FileList | File[]) => {
      const list = Array.from(picked);
      if (list.length === 0) return;
      setFailed([]);
      setError(null);

      const localRejects = list
        .map((f) => ({ f, problem: validateFile(f.name, f.size) }))
        .filter((x) => x.problem);
      if (localRejects.length > 0) {
        setFailed(localRejects.map((x) => ({ name: x.f.name, message: x.problem! })));
      }
      const ok = list.filter((f) => !validateFile(f.name, f.size));
      if (ok.length === 0) return;

      const key = `batch-${Date.now()}`;
      active.current += 1;
      setProgress((p) => ({ ...p, [key]: 1 }));

      await new Promise<void>((resolve) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/uploads");
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setProgress((p) => ({ ...p, [key]: Math.round((e.loaded / e.total) * 100) }));
        };
        xhr.onload = () => {
          try {
            const json = JSON.parse(xhr.responseText);
            if (xhr.status >= 200 && xhr.status < 300) {
              const fresh = (json.files ?? []) as StoredFile[];
              setFiles((prev) => [...fresh, ...prev]);
              setFailed((prev) => [...prev, ...((json.failed ?? []) as FailedFile[])]);
              // Kick off extraction so uploads become grounded source material.
              for (const f of fresh) {
                if (f.resourceId) {
                  fetch("/api/ingest", {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ resourceId: f.resourceId })
                  }).catch(() => {});
                }
              }
            } else if (xhr.status === 422) {
              setFailed((prev) => [...prev, ...((json.failed ?? []) as FailedFile[])]);
            } else {
              setError(json?.error?.message ?? `Upload failed (${xhr.status}).`);
            }
          } catch {
            setError("Upload response unreadable.");
          }
          setProgress((p) => {
            const next = { ...p };
            delete next[key];
            return next;
          });
          active.current -= 1;
          resolve();
        };
        xhr.onerror = () => {
          setError("Network error during upload.");
          setProgress((p) => {
            const next = { ...p };
            delete next[key];
            return next;
          });
          active.current -= 1;
          resolve();
        };
        const form = new FormData();
        form.set("scope", scope);
        form.set("courseId", courseId);
        ok.forEach((f) => form.append("files", f, f.name));
        xhr.send(form);
      });
    },
    [scope, courseId]
  );

  const remove = useCallback(async (path: string) => {
    const prev = files;
    setFiles((v) => v.filter((f) => f.path !== path));
    try {
      const res = await fetch("/api/uploads", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ paths: [path] })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? "Delete failed.");
    } catch (e) {
      setFiles(prev);
      setError(e instanceof Error ? e.message : "Delete failed.");
    }
  }, [files]);

  const busy = Object.keys(progress).length > 0;
  const overall = Object.values(progress)[0] ?? null;

  return { files, failed, loading, error, busy, overall, progress, dragOver, setDragOver, uploadMany, remove, refresh, dismissFailed: () => setFailed([]) };
}
