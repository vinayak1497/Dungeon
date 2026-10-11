# Hyperframes Composition Brief: Requiem — AI Study Canvas

## Objective
Create a 30-second cinematic launch-trailer brag video for Requiem, an AI study workspace (upload PDFs → auto-organized modules → grounded AI quizzes/flashcards → ink canvas).

## Output
- Composition directory: `brag-output/composition/`
- Rendered video: `brag-output/brag.mp4`
- Format: landscape — 1920x1080
- Duration: 30 seconds

## Source Material
- Project root: `C:\Users\Vinayak Umesh Kundar\Desktop\Requiem`
- Primary files read: `app/page.tsx` (hero "Study from *your* material.", pillars, CTAs), `app/globals.css` (paper grid, accent), `app/(app)/canvas/[canvasId]/page.tsx`, `app/(app)/quiz/*`, `app/(app)/flashcards/page.tsx`
- Product name: Requiem
- Tagline / strongest claim: "Study Smarter. Create Freely. Master Everything."
- Key UI or visual moment to recreate: paper-grid ink canvas with pen stroke + note block; module cards; MCQ quiz card with citation badge; flashcard flip
- Copy that must appear verbatim:
  - "STUDY FROM YOUR MATERIAL."
  - "Syllabus + PDFs become modules."
  - "Grounded AI, cited to your pages."
  - "Think on an infinite canvas."
  - "Study Smarter. Create Freely. Master Everything."

## Creative Direction
- Tone preset: cinematic
- Creative direction: hackathon-winning launch trailer in 16:9 — futuristic, premium dark, trailer-scale type
- Interpretation: 5 wide scenes ~6s each; declarative lines slam in fast then hold for reading; dramatic wipe/scale transitions; SFX restraint (big hits only)
- Angle: your pile of unread PDFs becomes a curriculum, a tutor, an examiner, and a sketchbook in 30 seconds — every claim is a real screen.
- Hook: PDF chip slam + "STUDY FROM YOUR MATERIAL." in the first 2 seconds
- Outro / punchline: 0.4s inhale → REQUIEM logo slam → three-beat tagline → hold on black
- Avoid:
  - Generic SaaS language
  - Abstract filler visuals
  - Unrelated visual redesign

## Visual Identity
- Background: #0B0B10 (premium dark; faint paper-grid motif at ~6% opacity)
- Text: #FAFAF8
- Muted text: #A7A7B3
- Accent: #7C6CFF
- Display font: Georgia, 'Times New Roman', serif (generic families only — no webfonts, satisfies font lint)
- Body font: system-ui, -apple-system, 'Segoe UI', sans-serif
- Visual references from the project: paper grid, rounded-2xl cards, pill badges, accent dot, mono index labels ("01/02/03")

## Storyboard
Use the storyboard in `brag-output/brag-plan.md` as the creative contract.

Scene summary:
1. Hook — 6s (0.00–6.00) — PDF chip slam + giant headline + sub-line hold
2. Organize — 6s (6.00–12.00) — 3 PDF chips + 3 module cards arriving on beat grid, AUTO-CLASSIFIED stamp
3. Learn — 6.56s (12.00–18.56) — MCQ build + answer lock-in + citation badge + flashcard flip (end beat-locked 18.56s)
4. Create — 6s (18.56–24.56) — ink stroke draw + note stamp + toolbar fade (end beat-locked 24.56s)
5. Outro — 5.44s (24.56–30.00) — inhale → logo slam → three-beat tagline → hold

## Audio
- Audio role: cinematic support
- Audio arc: cold open → ticking build (cards/lock-in) → breath (canvas) → swell + bell on logo → fade under tagline hold
- Music: assets/music/happy-beats-business-moves-vol-12-by-ende-dot-app.mp3 (already copied into composition)
- Music treatment: bed 0–30s at 0.35, fade-out 27–30s; data-duration 30 trims the 117s source
- Music cue guidance: bundled preset `<skill-dir>/assets/music/cues/happy-beats-business-moves-vol-12-by-ende-dot-app.music-cues.json` (109.96 BPM); locks: 18.56s + 24.56s scene boundaries (±0.15s — already exact); beat-grid arrivals at 6.56/7.64/8.74 in Scene 2
- Audio-reactive treatment: subtle; RMS breathes hero glow (Scene 1) and logo halo (Scene 5) only. No waveforms/notes/particles. (If the extraction helper is unavailable, skip and note it — do not block render.)
- Audio-coupled moments:
  - Scene 1 chip slam — tap
  - Scene 2 chips/cards — click / card-place per arrival
  - Scene 3 lock-in + citation — click + medium impact; flip — card-slide
  - Scene 4 note stamp — soft drop only (no whoosh on stroke)
  - Scene 5 logo — impactBell_heavy_000 once
- SFX selection guidance: card sounds for card arrivals, click for UI actions, one bell for the logo; polished restraint everywhere else
- SFX analysis guidance: `<skill-dir>/assets/sfx/sfx-analysis.md` (+json); prefer low/medium high-frequency-risk files for repeated moments
- Exact SFX choice: Hyperframes should choose filenames, timestamps, density, volume based on implemented animation (candidates already copied: casino/card-place-2, casino/card-slide-1, impact/impactBell_heavy_000, impact/impactSoft_medium_001, interface/click_001, interface/drop_002)
- Audio files: music + SFX candidates already in `brag-output/composition/assets/`

## Hyperframes Instructions
Load the composition-building Hyperframes domain skills — `hyperframes-core` (composition contract + `data-*` timing), `hyperframes-animation` (motion), `hyperframes-creative` (design spec, beats, audio-reactive), `hyperframes-keyframes` (seek-safe keyframes), and `hyperframes-cli` (lint/check/render). /brag is its own workflow: do not enter the `hyperframes` entry-point intent interview and do not route into its generic promo / launch-video workflow. Prefer native Hyperframes conventions over anything in `/brag`.

Requirements:
- Show at least one real UI, copy, or visual element from the source project.
- Keep all text readable in the final render.
- Keep the video within 30 seconds (explicit 30s promo request).
- Include the planned music/SFX layer unless audio was explicitly disabled or documented as intentionally silent.
- Treat /brag audio notes as guidance, not a fixed cue sheet. Choose SFX after the visual animation exists.
- Treat music cue metadata as optional timing hints. Hyperframes decides exact animation timing and should ignore cues that hurt readability, scene pacing, or the product story.
- Major reveals may move toward nearby strong cues within about 0.15s. Smaller entrances may align to nearby beat points within about 0.10s. Use only 1-3 strong cue locks in a 15-25s video unless the edit clearly benefits from more.
- Use SFX to support motion and interaction: card sounds for card-like reveals, short announcement cues for major payoffs, key/click sounds for text or user actions, and restraint when the edit is already busy.
- Honor planned music treatment such as fade-outs, ducking, beat-aligned reveals, or letting a final SFX ring over the music, using the best Hyperframes-supported implementation.
- When music is present and the treatment is not none, consider Hyperframes audio-reactive workflow: extract audio data and use RMS/frequency bands for subtle, brand-specific motion. Good targets are glow, depth, background warmth, card presence, title emphasis, or other existing visual elements. Avoid waveform/equalizer visuals, musical-note graphics, generic particle systems, strobing, or heavy pulsing.
- Use local assets for audio and any required runtime/media dependencies when possible.
- Run `hyperframes check` before render — it is brag's single gate.
- Keep creation and rendering local. Remote or publishing workflows require a separate explicit user request.
