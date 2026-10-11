import "server-only";

// Server-only provider routing. Reads configured keys at call time.
//
// NOTE (verified live, values never logged):
// - Gemini_AI in .env.local is rejected by Google (401, not an API key) → slot kept, skipped until a valid key is set.
// - Nugen_AI has no usable API endpoint → not wired.
// - Working: OpenRouter (paid models) and Groq (openai/gpt-oss-20b).
//
// Job routing: classification → OpenRouter first (instruction fidelity),
// quiz → Groq first (fast), everything else → OpenRouter first. Every job
// falls through the full chain before failing.

type ChatMsg = { role: "system" | "user" | "assistant"; content: string };
export type AiJob = "classify" | "quiz" | "general";

function keys() {
  return {
    // Only a real AIza key is attempted; OAuth-looking tokens are skipped.
    gemini: (process.env.Gemini_AI || "").startsWith("AIza") ? process.env.Gemini_AI! : "",
    openrouter: process.env.Openrouter_AI || "",
    groq: process.env.Groq_AI || ""
  };
}

export function aiStatus() {
  const k = keys();
  return {
    gemini: !!k.gemini,
    openrouter: !!k.openrouter,
    groq: !!k.groq,
    available: !!(k.gemini || k.openrouter || k.groq)
  };
}

async function geminiChat(msgs: ChatMsg[], maxTokens: number): Promise<string> {
  const system = msgs.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const contents = msgs.filter((m) => m.role !== "system").map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }]
  }));
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${keys().gemini}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: system ? { parts: [{ text: system }] } : undefined,
        contents,
        generationConfig: { maxOutputTokens: maxTokens, temperature: 0.2 }
      })
    }
  );
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const j = await res.json();
  const text = j?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("");
  if (!text) throw new Error("Gemini empty response");
  return text;
}

async function openrouterChat(msgs: ChatMsg[], maxTokens: number): Promise<string> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${keys().openrouter}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "requiem-app",
      "X-Title": "Requiem"
    },
    body: JSON.stringify({
      model: "openai/gpt-oss-20b",
      messages: msgs,
      max_tokens: maxTokens,
      temperature: 0.2
    })
  });
  if (!res.ok) throw new Error(`OpenRouter ${res.status}`);
  const j = await res.json();
  const text = j?.choices?.[0]?.message?.content;
  if (!text) throw new Error("OpenRouter empty response");
  return text;
}

async function groqChat(msgs: ChatMsg[], maxTokens: number): Promise<string> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${keys().groq}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "openai/gpt-oss-20b",
      messages: msgs,
      max_tokens: maxTokens,
      temperature: 0.2
    })
  });
  if (!res.ok) throw new Error(`Groq ${res.status}`);
  const j = await res.json();
  const text = j?.choices?.[0]?.message?.content;
  if (!text) throw new Error("Groq empty response");
  return text;
}

const CHAINS: Record<AiJob, ("gemini" | "openrouter" | "groq")[]> = {
  classify: ["gemini", "openrouter", "groq"],
  quiz: ["groq", "openrouter", "gemini"],
  general: ["openrouter", "groq", "gemini"]
};

// Role-routed chat with full fallback chain.
export async function aiChat(msgs: ChatMsg[], maxTokens = 1500): Promise<{ text: string; provider: string }> {
  return chatFor("general", msgs, maxTokens);
}

export async function chatFor(job: AiJob, msgs: ChatMsg[], maxTokens = 1500): Promise<{ text: string; provider: string }> {
  const k = keys();
  const runners = { gemini: geminiChat, openrouter: openrouterChat, groq: groqChat };
  const errs: string[] = [];
  for (const name of CHAINS[job]) {
    if (!k[name]) continue;
    try {
      return { text: await runners[name](msgs, maxTokens), provider: name };
    } catch (e) {
      errs.push(`${name}: ${e instanceof Error ? e.message : "failed"}`);
    }
  }
  throw new Error(errs.length ? `AI unavailable: ${errs.join("; ")}` : "No AI provider configured. Set Openrouter_AI or Groq_AI (see env.example).");
}

// Extracts the first JSON object/array from model output (strips fences).
export function parseJsonResult<T>(text: string): T {
  const clean = text.replace(/```json|```/g, "").trim();
  const start = Math.min(
    ...["{", "["].map((c) => (clean.indexOf(c) === -1 ? Infinity : clean.indexOf(c)))
  );
  const endObj = clean.lastIndexOf("}");
  const endArr = clean.lastIndexOf("]");
  const end = Math.max(endObj, endArr);
  if (start === Infinity || end === -1) throw new Error("Model returned no JSON.");
  return JSON.parse(clean.slice(start, end + 1)) as T;
}
