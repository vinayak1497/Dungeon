# Brag Plan: Requiem — AI Study Canvas

## What is this app?
Requiem is an AI-powered study workspace: students upload PDFs and syllabi, which become organized learning modules with grounded AI Q&A, adaptive quizzes, flashcards, revision sheets, curated videos, and a freehand digital canvas for notes.

## The angle
A hackathon-trailer for the most over-prepared student alive. The joke the product tells about itself: your pile of unread PDFs just became a curriculum, a tutor, an examiner, and a sketchbook — while you watched. Epic trailer grammar, but every claim is a real screen in the app.

## Hook (first 2-3 seconds)
Black screen. A single PDF chip slams in — "Lecture-04.pdf" — and the giant line lands with it: "STUDY FROM YOUR MATERIAL." (the app's own hero headline). One file, one sentence, zero setup shown yet. The question it plants: what happens to the file?

## Key moments (the middle)
- PDFs drop into the app one by one and auto-file into modules ("Syllabus + PDFs become modules" — the app's own pillar copy). A cursor-free simulated upload: chips land, module cards light up.
- A quiz card answers itself: MCQ options, the correct one locking in with a "cited to your pages" badge. Then a flashcard flips. Two assessment formats, one proof point: the AI only quotes your uploads.
- The ink canvas draws itself: a pen stroke sweeps across a dark paper grid and a note block stamps in — "Mitochondria = powerhouse." Handwriting energy without a hand.

## Outro / punchline
Full-screen logo slam: REQUIEM. Then the tagline, verbatim: "Study Smarter. Create Freely. Master Everything." Music swells, one bell hit, hold on black. The beat before the logo is a 0.4s near-silence — the trailer inhale.

## User flow worth showing
Upload PDFs → auto-classified modules appear → quiz/flashcard answered from those pages → ink note lands on the canvas. Entry → key action → result, all working-app moments.

## Tone
- Preset: cinematic
- Creative direction: hackathon-winning launch trailer in 16:9 — futuristic, premium dark, trailer-scale type
- Interpretation: 5 wide scenes at ~6s each; big declarative lines that land then hold; dramatic wipes with scale; restraint on SFX (2–3 big hits, the edit does the talking)

## Format: landscape — 1920x1080
## Duration: 30 seconds (explicit user request for a 30s social promo; cinematic pacing supports 5×6s scenes)

## Visual identity (from the project)
- Background: #0B0B10 (premium dark per brief; app's paper-grid motif recreated as a faint dark grid)
- Accent: #7C6CFF (app `--accent`, indigo)
- Text: #FAFAF8 (app selection/foreground light)
- Muted text: #A7A7B3
- Display font: Georgia, 'Times New Roman', serif (echoes the app's serif hero "Study from *your* material")
- Body font: system-ui, -apple-system, 'Segoe UI', sans-serif
- Strongest visual element: the paper-grid canvas + module/quiz/flashcard cards + the three pillar lines (Organize / Learn / Create)

## Share copy (draft)
Requiem turns your PDFs into modules, quizzes, flashcards, and a canvas — tutored by AI that only quotes your pages. Study Smarter. Create Freely. Master Everything.

## Audio direction
- Role: cinematic support — steady bed with a low swell into the logo, restrained motion-matched accents
- Music: happy-beats-business-moves-vol-12-by-ende-dot-app.mp3 (steady and clean, 109.96 BPM; preset cues read)
- Music treatment: full 30s bed at 0.35, gentle fade-out 27–30s; logo slam rides the swell
- Music cue guidance: preset `assets/music/cues/happy-beats-business-moves-vol-12…` (see skill dir); beat grid ~0.55s spacing. Strong-cue locks: scene 3→4 boundary at 18.56s (0.99 strong_beat), scene 4→5 boundary at 24.56s (0.99 strong_beat). Sequential card reveals in Scene 2 snap to every other beat (6.56 / 7.64 / 8.74) with full-set hold afterward for readability.
- Audio-reactive treatment: subtle; RMS breathes the hero glow and logo halo only. No waveforms/notes/particles.
- SFX posture: sparse — card-place for module cards, click for upload drops, impactSoft_medium for quiz lock-in, impactBell_heavy_000 for logo slam, drop_002 for label pop-ins
- Audio-coupled moments: PDF chips landing (tap each), module cards arriving one by one, quiz answer locking in, ink stroke sweeping, logo slam
- Restraint rule: no SFX under tagline hold; music never above 0.4; SFX never stacked

## Storyboard

### Scene 1 — Hook — 6s (0.00–6.00)
Black + faint grid. "Lecture-04.pdf" chip slams center at 0.5s, then giant lines arrive: "STUDY FROM" (1.2s) / "YOUR MATERIAL." in accent serif italic (2.0s). Sub-line "Upload PDFs. Get cited explanations, quizzes, and a canvas." settles at 3.4s and holds to 6.0s.
Sequential/interaction: chip slam → two headline lines → sub-line; or none beyond that order
Audio intent: cold open, one soft impact under the chip, bed establishes
Audio-coupled idea: chip landing tap; headline slams (no per-letter typing — too slow for trailer)
Music: vol-12 bed from 0s
Transition mood: dramatic wipe with scale → Scene 2

### Scene 2 — Organize — 6s (6.00–12.00)
"ORGANIZE" kicker + "Syllabus + PDFs become modules." Three PDF chips ("Syllabus.pdf", "Lecture-04.pdf", "Slides-07.pdf") drop in at 6.56 / 7.64 / 8.74s (every-other-beat), then three module cards ("Module 01 · Light Reactions", "Module 02 · Calvin Cycle", "Module 03 · Cell Energy") light up with accent edges and hold as a set to 12.0s. "AUTO-CLASSIFIED" stamp at 10.2s.
Sequential/interaction: yes — 3 chips then 3 cards, beat-grid arrivals, full-set hold (readable, not rushed)
Audio intent: momentum building, card sounds ticking with arrivals
Audio-coupled idea: card-place per card; click per chip drop
Music: bed continues
Transition mood: dramatic wipe with scale → Scene 3

### Scene 3 — Learn — 6.56s (12.00–18.56)
"LEARN" kicker + "Grounded AI, cited to your pages." A quiz card builds: "MCQ · What powers the light reactions?" + 4 options; option B locks with accent fill at ~15.2s and a "CITED · Lecture-04.pdf p.3" badge stamps at 16.0s. A flashcard ("ATP = ?" → flips → "cellular energy currency") flips at 16.8–17.8s. Holds to boundary beat-locked at 18.56s.
Sequential/interaction: yes — question → options → lock-in → citation badge → card flip
Audio intent: payoff moment; single medium impact under the lock-in
Audio-coupled idea: click on lock-in; card-slide on flip; impactSoft_medium under citation badge
Music: bed continues
Transition mood: dramatic wipe with scale → Scene 4 (boundary beat-locked: 18.56s)

### Scene 4 — Create — 6s (18.56–24.56)
"CREATE" kicker + "Think on an infinite canvas." Dark paper grid fills frame; an ink stroke (accent, round cap) sweeps across 19.5–21.5s via stroke draw; a note block stamps "Mitochondria = powerhouse." at 22.0s with a pen-color spine; small toolbar glyphs (pen / highlighter / eraser) fade in along the left edge. Holds to boundary beat-locked at 24.56s.
Sequential/interaction: stroke draw (simulated pen, no cursor) → note stamp → tools fade
Audio intent: breath before the finale; soft drop under the note stamp only
Audio-coupled idea: none for the stroke (a whoosh would cheapen it); drop_002 on stamp
Music: bed swells toward logo
Transition mood: slow crossfade with scale → Scene 5 (boundary beat-locked: 24.56s)

### Scene 5 — Outro — 5.44s (24.56–30.00)
0.4s near-black inhale (24.56–25.0). "REQUIEM" slams full-screen at 25.2s with halo glow; tagline "Study Smarter. Create Freely. Master Everything." arrives in three beats (26.0 / 26.8 / 27.6) and holds to 30.0s. Music fades 27–30s.
Sequential/interaction: logo slam → tagline in three beats, then hold
Audio intent: swell + single bell hit on the slam, then silence under the hold
Audio-coupled idea: impactBell_heavy_000 on logo landing only
Music: fade-out 27–30s; end of bed trimmed at 30s
Transition mood: none (end card holds to black)

**Music mood for this video:** cinematic
**Audio summary:** steady vol-12 bed under a five-scene build, ticking card/click accents in the middle, one bell on the logo, silence under the tagline hold.
