// Canvas document schema. Backward compatible:
// v1 = { version:1, elements:[{id,text}] }
// v1 + strokes (additive, optional) — old documents still validate.

export type Stroke = {
  id: string;
  tool: "pen" | "highlighter" | "eraser";
  color: string;
  width: number;
  opacity: number;
  points: [number, number][];
};

export type Shape = {
  id: string;
  kind: "rect" | "circle" | "arrow";
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  strokeWidth: number;
};

export type Doc = {
  version: 1;
  elements: { id: string; text: string }[];
  strokes?: Stroke[];
  shapes?: Shape[];
};

export const MAX_STROKES = 2000;
export const MAX_POINTS = 4000;
export const MAX_ELEMENTS = 500;
export const MAX_SHAPES = 200;
const OPACITY: Record<string, number> = { pen: 1, highlighter: 0.32, eraser: 1 };

export function emptyDoc(): Doc {
  return { version: 1, elements: [], strokes: [] };
}

export function normalizeOpacity(tool: string): number {
  return OPACITY[tool] ?? 1;
}

export function normalizeWidth(tool: string, width: number): number {
  if (tool === "highlighter") return Math.max(6, width * 4);
  return Math.min(40, Math.max(0.5, width));
}

function validStroke(s: unknown): boolean {
  if (!s || typeof s !== "object") return false;
  const o = s as Record<string, unknown>;
  if (typeof o.id !== "string" || o.id.length > 64) return false;
  if (o.tool !== "pen" && o.tool !== "highlighter" && o.tool !== "eraser") return false;
  if (typeof o.color !== "string" || o.color.length > 32) return false;
  if (typeof o.width !== "number" || !(o.width > 0) || o.width > 64) return false;
  if (typeof o.opacity !== "number" || o.opacity < 0 || o.opacity > 1) return false;
  if (!Array.isArray(o.points) || o.points.length === 0 || o.points.length > MAX_POINTS) return false;
  return o.points.every(
    (p) => Array.isArray(p) && p.length === 2 && typeof p[0] === "number" && typeof p[1] === "number" && Number.isFinite(p[0]) && Number.isFinite(p[1])
  );
}

function validShape(s: unknown): boolean {
  if (!s || typeof s !== "object") return false;
  const o = s as Record<string, unknown>;
  if (typeof o.id !== "string" || o.id.length > 64) return false;
  if (o.kind !== "rect" && o.kind !== "circle" && o.kind !== "arrow") return false;
  if (typeof o.color !== "string" || o.color.length > 32) return false;
  if (typeof o.strokeWidth !== "number" || !(o.strokeWidth > 0) || o.strokeWidth > 64) return false;
  return ["x", "y", "w", "h"].every((k) => typeof o[k] === "number" && Number.isFinite(o[k] as number) && Math.abs(o[k] as number) < 100000);
}

/** Server-side guard. Accepts legacy docs without strokes/shapes. */
export function isValidDoc(doc: unknown): doc is Doc {
  if (!doc || typeof doc !== "object") return false;
  const d = doc as { version?: unknown; elements?: unknown; strokes?: unknown; shapes?: unknown };
  if (d.version !== 1) return false;
  if (!Array.isArray(d.elements) || d.elements.length > MAX_ELEMENTS) return false;
  if (!d.elements.every((el) => el && typeof el === "object" && typeof (el as { id?: unknown }).id === "string" && typeof (el as { text?: unknown }).text === "string")) {
    return false;
  }
  if (d.strokes === undefined || d.strokes === null) {
    // shapes may only ride along with a valid strokes/elements base
    if (d.shapes !== undefined && d.shapes !== null) {
      if (!Array.isArray(d.shapes) || d.shapes.length > MAX_SHAPES) return false;
      if (!d.shapes.every(validShape)) return false;
    }
    return true;
  }
  if (!Array.isArray(d.strokes) || d.strokes.length > MAX_STROKES) return false;
  if (!d.strokes.every(validStroke)) return false;
  if (d.shapes !== undefined && d.shapes !== null) {
    if (!Array.isArray(d.shapes) || d.shapes.length > MAX_SHAPES) return false;
    if (!d.shapes.every(validShape)) return false;
  }
  return true;
}

/** Coerce unknown doc into a safe Doc (drops malformed strokes/shapes). */
export function coerceDoc(raw: unknown): Doc {
  const doc: Doc = { version: 1, elements: [], strokes: [], shapes: [] };
  if (!raw || typeof raw !== "object") return doc;
  const r = raw as { elements?: unknown; strokes?: unknown; shapes?: unknown };
  if (Array.isArray(r.elements)) {
    doc.elements = r.elements
      .filter((el) => el && typeof el === "object" && typeof (el as { id?: unknown }).id === "string")
      .slice(0, MAX_ELEMENTS)
      .map((el) => ({ id: String((el as { id: string }).id).slice(0, 64), text: String((el as { text?: unknown }).text ?? "").slice(0, 8000) }));
  }
  if (Array.isArray(r.strokes)) {
    doc.strokes = r.strokes.filter(validStroke).slice(0, MAX_STROKES) as Stroke[];
  }
  if (Array.isArray(r.shapes)) {
    doc.shapes = r.shapes.filter(validShape).slice(0, MAX_SHAPES) as Shape[];
  }
  return doc;
}

/** Flatten page text for AI context. */
export function docText(doc: Doc): string {
  return doc.elements.map((e) => e.text.trim()).filter(Boolean).join("\n\n");
}