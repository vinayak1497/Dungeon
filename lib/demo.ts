// Demo data provider — intentionally generic, no hardcoded student/course identity.
// In production this is replaced by authenticated Supabase records.
export const demo = {
  courses: [
    { id: "course-1", code: "CS-301", title: "Course Alpha", modules: 6, resources: 20, progress: 62, status: "in-progress" as const, examInDays: 4 },
    { id: "course-2", code: "CS-302", title: "Course Beta", modules: 5, resources: 14, progress: 34, status: "in-progress" as const },
    { id: "course-3", code: "MS-201", title: "Course Gamma", modules: 4, resources: 9, progress: 0, status: "not-started" as const }
  ],
  modules: [
    { id: "m1", title: "Module 01 — Foundations", concepts: 4, resources: 5, status: "done" as const },
    { id: "m2", title: "Module 02 — Core Methods", concepts: 5, resources: 6, status: "done" as const },
    { id: "m3", title: "Module 03 — Ensemble Methods", concepts: 6, resources: 4, status: "active" as const },
    { id: "m4", title: "Module 04 — Unsupervised", concepts: 4, resources: 3, status: "locked" as const },
    { id: "m5", title: "Module 05 — Networks", concepts: 5, resources: 2, status: "locked" as const },
    { id: "m6", title: "Module 06 — Evaluation", concepts: 3, resources: 0, status: "locked" as const }
  ],
  concepts: [
    { id: "c1", title: "Concept A", status: "mastered" as const, resources: 3 },
    { id: "c2", title: "Concept B", status: "practicing" as const, resources: 2 },
    { id: "c3", title: "Concept C", status: "weak" as const, resources: 2 },
    { id: "c4", title: "Concept D", status: "new" as const, resources: 1 }
  ]
};

export const routes = {
  dashboard: "/dashboard",
  newCourse: "/courses/new",
  canvas: "/canvas/studio",
  quizSetup: "/quiz/setup",
  flashcards: "/flashcards",
  revision: "/revision",
  settings: "/settings"
};
