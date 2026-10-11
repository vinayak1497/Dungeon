// Content-refinement modes shared by the API route and the client UI.

export const REFINE_MODES = ["simplify", "grammar", "organize", "improve", "exam"] as const;
export type RefineMode = (typeof REFINE_MODES)[number];

export const REFINE_INSTRUCTIONS: Record<RefineMode, string> = {
  simplify: "Rewrite in plainer language at the same level of meaning. Shorter sentences, no jargon.",
  grammar: "Fix grammar, spelling and punctuation only. Keep the wording and meaning identical.",
  organize: "Restructure into clear headings with short bullet points. Keep every original fact.",
  improve: "Improve clarity and flow of this written answer. Keep all facts accurate.",
  exam: "Convert into exam-ready revision material: concise key points, key definitions, and likely question phrasing."
};

export const REFINE_LABELS: Record<RefineMode, string> = {
  simplify: "Simplify",
  grammar: "Fix grammar",
  organize: "Organize",
  improve: "Improve",
  exam: "Exam-ready"
};