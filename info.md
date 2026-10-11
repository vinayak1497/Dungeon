# Requiem — Project Explainer (mapped to the problem statement)

## Background: the problem we solve
Students scatter study material across notebooks, documents, drawing apps, and
PDFs, so organizing, revising, and reusing it is painful. Writing summaries,
practice questions, and clearer explanations by hand takes hours. And when
Generative AI is bolted on, it usually answers from generic knowledge instead
of the student's own notes — unable to tell what lives on the current page
versus across a whole project.

**Requiem** is a web-based digital study canvas that fixes exactly this: one
workspace where students take notes, organize them into projects, and revise
with an AI assistant grounded in their own material.

## What we built (one paragraph)
Requiem lets students create projects containing multiple canvas pages; write
and draw with pen, highlighter, shapes, and arrows on a real HTML canvas;
add and edit text blocks; erase ink or delete blocks; change color and
thickness; save everything and reopen it later; and export the whole project
as an ordered PDF. A Generative AI assistant reads the selected text, the
current page, or the complete project as appropriate — answering questions,
explaining concepts, summarizing, generating quizzes (MCQ, true/false,
short-answer), and refining notes (simplify, grammar, organize, improve,
exam-ready). Every AI answer is grounded in the student's notes with sources
cited, the AI says so explicitly when the material is insufficient, and it
never replaces original content without confirmation. On top: AI flashcards,
adaptive quizzes, smart revision sheets, selected-content assistance, and
personalized recommendations.

## 1. Canvas-based note editor — how it's implemented
- **Real HTML Canvas API.** The editor centers on `components/canvas/ink-layer.tsx`,
  a `<canvas>` 2D layer supporting **pen** (opaque strokes), **highlighter**
  (translucent wide strokes), **eraser** (removes ink brushed over),
  **shapes/arrows**, and **lasso** selection with Delete. Color and thickness
  controls feed `normalizeOpacity`/`normalizeWidth` in `lib/canvas/doc.ts`.
- **Text + ink together.** Typed notes live in draggable text blocks beside the
  ink layer; both persist in one versioned document
  (`{ version: 1, elements, strokes, shapes }`), validated by
  `coerceDoc`/`isValidDoc` so old pages still load.
- **Edit + undo.** Inline block editing, block duplicate/delete, separate undo
  stacks for text and ink, zoom control, and debounced autosave with
  stale-overwrite protection (`PUT /api/canvas/pages/[pageId]`).
- **Multiple pages per project**, switched via a thumbnail navigator.

## 2. Project and multi-page management — how it's implemented
- **Projects → pages model** in Supabase (`canvas_projects` → `canvas_pages`
  with persisted `position`). Create many projects; each holds many pages.
- **Full page operations:** add, rename (page title + project rename via
  `PATCH /api/canvas/projects/[projectId]`), delete (page, plus project delete
  with cascade), **persisted reorder** (`PUT …/reorder { order }`, optimistic UI
  with rollback), and one-click switching that remembers the last open page.
- **Reopen-safe:** project load returns project + first page + ordered page
  list; everything is ownership-checked per user.
- **Project PDF export in order:** `GET …/export` returns every page in
  persisted `position` order; the client renders a paginated print layout
  (titles, `Page i of N`, text plus ink strokes as SVG) and exports the complete
  project to PDF via print-to-PDF.

## 3. AI study assistant — how it's implemented
- **Scope-aware context** (`POST /api/ai/canvas`): the assistant accepts
  **Selection / Page / Project / Course** scopes. Page scope loads that page's
  notes; project scope concatenates every page in order; selection scope uses
  exactly the highlighted text; course scope adds uploaded-course excerpts as
  supporting material. Notes and sources are kept visibly separate in the
  prompt so the model never confuses them.
- **Note-based Q&A, explanations, summaries:** one grounded endpoint serves
  free questions, concept explanations, page summaries, and whole-project
  summaries, with citations rendered as source chips in the UI.
- **Quiz generation** (`POST /api/quiz/generate`): grounded in the student's
  chunks, producing validated **MCQ, true/false, and short-answer** questions
  (the setup UI even lets students pick which types to include), with
  difficulty rules (easy/medium/hard) and emphasis on previously-missed ideas.
- **Content refinement** (`POST /api/ai/refine` + `lib/ai/refine.ts`): five
  modes — **simplify, fix grammar, organize, improve, exam-ready** — each with
  a purpose-written instruction that preserves meaning and adds no new facts.
- **Grounded + honest:** the system prompt forces answers from the provided
  evidence only, with an `INSUFFICIENT` path. Empty notes, missing sources, or
  no provider each produce a calm, explicit message — never a fabricated answer.
- **No silent overwrites:** every AI proposal goes through a **Review change**
  modal showing Original vs Proposed, with Accept / Insert-as-new / Cancel.

## 4. Summary, quiz, and refinement — how it's implemented
- Summaries of the **current page or the whole project** via scoped AI calls
  with one-click shortcuts ("Summarize this page", "Summarize whole project").
- Quizzes of all three required types, auto-graded server-side (exact for
  MCQ/true-false, keyword-overlap heuristic — clearly labeled — for
  short-answer), with per-question explanations.
- Refinement flows reuse the same confirmation modal, so simplifying,
  grammar-fixing, restructuring, answer-improving, and exam-prepping a note is
  always a proposal first, never an overwrite.

## Brownie points — how each is implemented
- **AI flashcards:** grounded deck generation (`POST /api/flashcards/generate`,
  422 when there's no material yet), flip-to-study UI, and Again/Hard/Good/Easy
  grading persisted to schedule reviews.
- **Adaptive quiz:** difficulty selector plus history-driven adaptation —
  `GET /api/learning/recommendations` computes a recommended difficulty from
  real last/average scores, weak misses steer generation, setup offers
  one-click "use recommended," and results link an adaptive follow-up quiz;
  `?difficulty=` deep-links carry the adaptation.
- **Smart revision mode:** `POST /api/revision/sheets` emits key points,
  definitions, comparisons, and practice items from the sources, fused with
  genuinely-missed quiz topics — plus Markdown export.
- **Selected-content assistance:** highlighting text inside any block sets the
  Selection scope (or picks the refine target); lasso-selected ink can be
  deleted; the AI then explains, summarizes, or improves only that span, and
  refuses with a clear message when nothing is selected.
- **Personalized learning:** the recommendations API derives weak topics,
  next-step recommendations (revise / easier / harder quiz / flashcards /
  revision sheet), and a personalized 4-day plan purely from real quiz history
  — falling back to an honest generic plan with zero history, never invented
  topics.

## Bonus intelligence: automatic organization
Uploading PDFs triggers extraction + chunking (`/api/ingest`), then each file
is **automatically classified into the syllabus or its best-fit module**:
deterministic syllabus detection (`lib/ai/autoAssign.ts`), AI classification
with a keyword-scoring fallback (so files are never stranded by an AI outage),
course-scoped queries with legacy backfill, and a mapping UI that reports
exactly what was filed where before the student confirms.

## Integrity guarantees (evaluator checklist)
- AI distinguishes **current page vs whole project** via explicit scopes.
- Answers cite the student's material; **insufficient material → explicit
  "not enough" state**, no guessing.
- **Original content is never replaced without confirmation** (review modal).
- Everything is per-user ownership-checked; AI degrades gracefully with clear
  messages when unconfigured or unevidenced.

## Tech stack
Next.js 14 (App Router) · React 18 · Supabase (Postgres, Auth, Storage) ·
HTML Canvas API + SVG · Tailwind CSS · Framer Motion · Groq / OpenRouter /
Gemini provider routing with per-job fallback · Headless-Chromium-verified UI.
