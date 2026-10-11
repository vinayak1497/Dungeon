"use client";
import { useCallback, useEffect, useRef } from "react";
import { normalizeOpacity, normalizeWidth, type Stroke, type Shape } from "@/lib/canvas/doc";

type Props = {
  strokes: Stroke[];
  shapes: Shape[];
  onStroke: (s: Stroke) => void;
  onStrokes: (next: Stroke[]) => void;
  onShapes: (next: Shape[]) => void;
  onCommit: () => void;
  tool: string;
  color: string;
  width: number;
  zoom: number;
  /** Renders the saved ink; user input is ignored while false. */
  interactive: boolean;
  /** Ids currently lasso-selected (drawn highlighted). */
  selection?: string[];
  onSelectionChange?: (ids: string[]) => void;
  className?: string;
};

const uid = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `s${Date.now()}${Math.random().toString(36).slice(2, 8)}`);

/** Distance (world units) from a point to a stroke segment. */
function distToSeg(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

export function InkLayer({ strokes, shapes, onStroke, onStrokes, onShapes, onCommit, tool, color, width, zoom, interactive, selection, onSelectionChange, className }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const cvRef = useRef<HTMLCanvasElement>(null);
  const current = useRef<Stroke | null>(null);
  const draftShape = useRef<Shape | null>(null);
  const lassoStart = useRef<[number, number] | null>(null);
  const lassoNow = useRef<[number, number] | null>(null);
  const strokesRef = useRef<Stroke[]>(strokes);
  const shapesRef = useRef<Shape[]>(shapes);
  strokesRef.current = strokes;
  shapesRef.current = shapes;

  const scale = zoom / 100;

  const draw = useCallback(() => {
    const cv = cvRef.current;
    const wrap = wrapRef.current;
    if (!cv || !wrap) return;
    const rect = wrap.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(rect.width * dpr));
    const h = Math.max(1, Math.round(rect.height * dpr));
    if (cv.width !== w || cv.height !== h) {
      cv.width = w;
      cv.height = h;
    }
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);

    const all = current.current ? [...strokesRef.current, current.current] : strokesRef.current;
    const sel = new Set(selection ?? []);
    const showShape = draftShape.current ?? null;

    // Shapes sit under the ink.
    for (const s of [...shapesRef.current, ...(showShape ? [showShape] : [])]) {
      const isSel = sel.has(s.id);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      ctx.strokeStyle = isSel ? "#4f43e8" : s.color;
      ctx.lineWidth = isSel ? s.strokeWidth + 1.5 : s.strokeWidth;
      ctx.fillStyle = `${s.color}14`;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      if (s.kind === "rect") ctx.rect(s.x, s.y, s.w, s.h);
      else if (s.kind === "circle") ctx.ellipse(s.x + s.w / 2, s.y + s.h / 2, Math.abs(s.w / 2), Math.abs(s.h / 2), 0, 0, Math.PI * 2);
      else {
        // arrow: shaft + head
        const x1 = s.x;
        const y1 = s.y;
        const x2 = s.x + s.w;
        const y2 = s.y + s.h;
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        const ang = Math.atan2(y2 - y1, x2 - x1);
        const head = 12 + s.strokeWidth * 2;
        ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - head * Math.cos(ang - 0.4), y2 - head * Math.sin(ang - 0.4));
        ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - head * Math.cos(ang + 0.4), y2 - head * Math.sin(ang + 0.4));
      }
      ctx.stroke();
      if (s.kind !== "arrow") ctx.fill();
    }

    // Highlighter first so ink sits on top.
    const order = [...all].sort((a, b) => (a.tool === "highlighter" ? -1 : 1) - (b.tool === "highlighter" ? -1 : 1));
    for (const s of order) {
      if (s.points.length === 0) continue;
      const isSel = sel.has(s.id);
      ctx.globalCompositeOperation = s.tool === "eraser" ? "destination-out" : "source-over";
      ctx.strokeStyle = s.tool === "eraser" ? "#000" : isSel ? "#4f43e8" : s.color;
      ctx.globalAlpha = isSel ? Math.min(1, s.opacity + 0.25) : s.opacity;
      ctx.lineWidth = s.width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      const [x0, y0] = s.points[0];
      ctx.moveTo(x0 * scale, y0 * scale);
      if (s.points.length === 1) {
        ctx.lineTo(x0 * scale + 0.01, y0 * scale + 0.01);
      } else {
        for (let i = 1; i < s.points.length - 1; i++) {
          const [x1, y1] = s.points[i];
          const [x2, y2] = s.points[i + 1];
          ctx.quadraticCurveTo(x1 * scale, y1 * scale, ((x1 + x2) / 2) * scale, ((y1 + y2) / 2) * scale);
        }
        const last = s.points[s.points.length - 1];
        ctx.lineTo(last[0] * scale, last[1] * scale);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";

    // Lasso region overlay
    if (lassoStart.current && lassoNow.current) {
      const x = Math.min(lassoStart.current[0], lassoNow.current[0]) * scale;
      const y = Math.min(lassoStart.current[1], lassoNow.current[1]) * scale;
      const w = Math.abs(lassoNow.current[0] - lassoStart.current[0]) * scale;
      const h = Math.abs(lassoNow.current[1] - lassoStart.current[1]) * scale;
      ctx.fillStyle = "rgba(79,67,232,.10)";
      ctx.strokeStyle = "#4f43e8";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.fillRect(x, y, w, h);
      ctx.strokeRect(x, y, w, h);
      ctx.setLineDash([]);
    }
  }, [scale, selection]);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => draw());
    ro.observe(el);
    return () => ro.disconnect();
  }, [draw]);

  // Repaint on zoom changes.
  useEffect(() => {
    draw();
  }, [zoom, draw]);

  const pointFrom = (e: React.PointerEvent<HTMLCanvasElement>): [number, number] | null => {
    const cv = cvRef.current;
    if (!cv) return null;
    const r = cv.getBoundingClientRect();
    return [(e.clientX - r.left) / scale, (e.clientY - r.top) / scale];
  };

  const strokeTool = (interactive ? tool : "select") as string;

  const handleDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!interactive) return;
    const p = pointFrom(e);
    if (!p) return;
    const t = strokeTool;

    if (t === "shapes" || t === "arrow") {
      e.preventDefault();
      (e.target as HTMLCanvasElement).setPointerCapture?.(e.pointerId);
      draftShape.current = {
        id: uid(),
        kind: t === "arrow" ? "arrow" : "rect",
        x: p[0],
        y: p[1],
        w: 0,
        h: 0,
        color,
        strokeWidth: Math.max(1.5, width)
      };
      draw();
      return;
    }

    if (t === "lasso") {
      e.preventDefault();
      (e.target as HTMLCanvasElement).setPointerCapture?.(e.pointerId);
      lassoStart.current = p;
      lassoNow.current = p;
      draw();
      return;
    }

    if (t === "pen" || t === "highlighter" || t === "eraser") {
      e.preventDefault();
      (e.target as HTMLCanvasElement).setPointerCapture?.(e.pointerId);
      current.current = {
        id: uid(),
        tool: t as Stroke["tool"],
        color: t === "eraser" ? "#000000" : color,
        width: normalizeWidth(t, t === "highlighter" ? Math.max(width, 4) : width),
        opacity: normalizeOpacity(t),
        points: [p]
      };
      draw();
    }
  };

  const handleMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!interactive) return;
    const p = pointFrom(e);
    if (!p) return;

    if (draftShape.current) {
      draftShape.current.w = p[0] - draftShape.current.x;
      draftShape.current.h = p[1] - draftShape.current.y;
      draw();
      return;
    }
    if (lassoStart.current) {
      lassoNow.current = p;
      draw();
      return;
    }
    if (!current.current) return;
    const pts = current.current.points;
    const last = pts[pts.length - 1];
    if (Math.hypot(p[0] - last[0], p[1] - last[1]) < 1.2) return;
    pts.push(p);
    if (pts.length > 4000) finish();
    draw();
  };

  /** Select every stroke/shape whose points fall inside the lasso rect. */
  const applyLasso = () => {
    const a = lassoStart.current;
    const b = lassoNow.current;
    lassoStart.current = null;
    lassoNow.current = null;
    if (!a || !b || !onSelectionChange) {
      draw();
      return;
    }
    const x1 = Math.min(a[0], b[0]);
    const y1 = Math.min(a[1], b[1]);
    const x2 = Math.max(a[0], b[0]);
    const y2 = Math.max(a[1], b[1]);
    const inside = (px: number, py: number) => px >= x1 && px <= x2 && py >= y1 && py <= y2;

    const pickedStrokes = strokesRef.current.filter((s) => s.points.some((pt) => inside(pt[0], pt[1]))).map((s) => s.id);
    const pickedShapes = shapesRef.current.filter((s) => inside(s.x, s.y) || inside(s.x + s.w, s.y + s.h)).map((s) => s.id);
    onSelectionChange([...pickedStrokes, ...pickedShapes]);
    draw();
  };

  const finish = () => {
    if (draftShape.current) {
      const s = draftShape.current;
      draftShape.current = null;
      if (Math.abs(s.w) > 4 || Math.abs(s.h) > 4) onShapes([...shapesRef.current, s]);
      onCommit();
      draw();
      return;
    }
    if (lassoStart.current) {
      applyLasso();
      return;
    }
    const s = current.current;
    current.current = null;
    if (s && s.points.length > 0) onStroke(s);
    onCommit();
    draw();
  };

  /** Deletes whatever the lasso currently has selected. */
  const deleteSelection = () => {
    const sel = new Set(selection ?? []);
    if (sel.size === 0) return;
    onStrokes(strokesRef.current.filter((s) => !sel.has(s.id)));
    onShapes(shapesRef.current.filter((s) => !sel.has(s.id)));
    onSelectionChange?.([]);
    onCommit();
    draw();
  };

  // Expose lasso delete to the parent via a ref-like imperative handle.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "Delete" || e.key === "Backspace") && interactive && tool === "lasso" && (selection?.length ?? 0) > 0) {
        e.preventDefault();
        deleteSelection();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const eraseAt = (p: [number, number], radius: number) => {
    const kept = strokesRef.current.filter((s) => {
      if (s.tool === "eraser") return true;
      const r = Math.max(radius, s.width / 2);
      for (let i = 0; i < s.points.length - 1; i++) {
        if (distToSeg(p[0], p[1], s.points[i][0], s.points[i][1], s.points[i + 1][0], s.points[i + 1][1]) <= r) return false;
      }
      return true;
    });
    if (kept.length !== strokesRef.current.length) {
      strokesRef.current = kept;
      onStrokes(kept);
    }
  };

  // Tool-eraser: remove nearby strokes on click/drag without touching text.
  useEffect(() => {
    const cv = cvRef.current;
    if (!cv || !interactive || tool !== "eraser" || current.current) return;
    const onMove = (e: PointerEvent) => {
      const r = cv.getBoundingClientRect();
      const p: [number, number] = [(e.clientX - r.left) / scale, (e.clientY - r.top) / scale];
      eraseAt(p, Math.max(width * 3, 8));
      draw();
    };
    const onUp = () => onCommit();
    cv.addEventListener("pointermove", onMove);
    cv.addEventListener("pointerup", onUp);
    cv.addEventListener("pointerleave", onUp);
    return () => {
      cv.removeEventListener("pointermove", onMove);
      cv.removeEventListener("pointerup", onUp);
      cv.removeEventListener("pointerleave", onUp);
    };
  });

  const cursor =
    !interactive ? "default"
    : tool === "pen" || tool === "highlighter" ? "crosshair"
    : tool === "eraser" ? "cell"
    : tool === "lasso" ? "crosshair"
    : tool === "shapes" || tool === "arrow" ? "crosshair"
    : "default";

  return (
    <div ref={wrapRef} className={className} style={{ position: "absolute", inset: 0 }}>
      <canvas
        ref={cvRef}
        style={{ width: "100%", height: "100%", touchAction: "none", cursor, display: "block" }}
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={finish}
        onPointerCancel={finish}
        onPointerLeave={finish}
      />
    </div>
  );
}