import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Free AI via Groq (OpenAI-compatible API). Add GROQ_API_KEY in Vercel -> Settings -> Environment Variables.
const GROQ_URL = "https://api.groq.com/openai/v1";
const MODEL = "llama-3.3-70b-versatile";
const FALLBACK_MODEL = "llama-3.1-8b-instant";
const STT_MODEL = "whisper-large-v3-turbo";

type Msg = { role: "user" | "assistant"; content: string };

class AiError extends Error {
  constructor(
    public kind: "missing_key" | "rate_limit" | "auth" | "failed",
    message: string,
  ) {
    super(message);
  }
}

function friendly(e: unknown): string {
  console.error("AI request failed", e);
  if (e instanceof AiError) {
    if (e.kind === "missing_key") return "AI is not set up yet. Add GROQ_API_KEY in your Vercel settings.";
    if (e.kind === "rate_limit") return "AI is busy right now. Please wait a moment and try again.";
    if (e.kind === "auth") return "The AI key was rejected. Check GROQ_API_KEY in your Vercel settings.";
  }
  return "AI request failed. Please try again.";
}

function apiKey(): string {
  const key = process.env["GROQ_API_KEY"];
  if (!key) throw new AiError("missing_key", "GROQ_API_KEY is not set");
  return key;
}

async function groqFetch(path: string, init: RequestInit): Promise<Response> {
  const res = await fetch(`${GROQ_URL}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${apiKey()}`, ...(init.headers ?? {}) },
  });
  if (res.ok) return res;
  const body = await res.text().catch(() => "");
  if (res.status === 429) throw new AiError("rate_limit", body);
  if (res.status === 401 || res.status === 403) throw new AiError("auth", body);
  throw new AiError("failed", `${res.status} ${body}`);
}

async function chat(model: string, instructions: string, input: Msg[]): Promise<string> {
  const res = await groqFetch("/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      temperature: 0.6,
      max_tokens: 1200,
      messages: [{ role: "system", content: instructions }, ...input],
    }),
  });
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const text = json.choices?.[0]?.message?.content?.trim();
  if (!text) throw new AiError("failed", "Empty AI response");
  return text;
}

async function run(instructions: string, input: Msg[]) {
  try {
    return await chat(MODEL, instructions, input);
  } catch (firstError) {
    // Do not retry when the key is missing or rejected; only fall back for busy/other errors.
    if (firstError instanceof AiError && (firstError.kind === "missing_key" || firstError.kind === "auth")) {
      throw firstError;
    }
    console.warn("AI primary model failed; trying fallback", firstError);
    return await chat(FALLBACK_MODEL, instructions, input);
  }
}

const COMPANION = `You are NEXORA's AI companion inside a Kenyan super-app (feeds, messages, maps, wallet, live, clubs, hub tools).
Be concise, warm and practical. Use markdown. Never claim to perform payments, send messages, or access live location; explain where in the app the user can do it.`;

export const aiChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { messages: Msg[] }) => {
    const messages = (d?.messages ?? [])
      .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .slice(-30)
      .map((m) => ({ role: m.role, content: m.content.slice(0, 8000) }));
    if (!messages.length) throw new Error("Empty conversation");
    return { messages };
  })
  .handler(async ({ data }) => {
    try {
      return { text: await run(COMPANION, data.messages), error: null as string | null };
    } catch (e) {
      return { text: "", error: friendly(e) };
    }
  });

const TASKS = {
  summarize: `Summarize the user's content. Return markdown with sections: **Summary** (2-4 sentences), **Action items** (bullets), **Tags** (5-8 #hashtags on one line). If the content is only a URL, say you cannot open links and ask them to paste the text.`,
  caption: `You are a creator copilot. From the user's idea, return markdown with: **3 titles**, **Caption** (under 150 words), **Hashtags** (8-12), **Hook ideas** (3 one-line opening hooks for a short video).`,
} as const;

export const aiTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { task: keyof typeof TASKS; text: string }) => {
    if (!(d?.task in TASKS)) throw new Error("Unknown task");
    const text = String(d.text ?? "")
      .trim()
      .slice(0, 20000);
    if (!text) throw new Error("Nothing to process");
    return { task: d.task, text };
  })
  .handler(async ({ data }) => {
    try {
      return {
        text: await run(TASKS[data.task], [{ role: "user", content: data.text }]),
        error: null as string | null,
      };
    } catch (e) {
      return { text: "", error: friendly(e) };
    }
  });

export const aiTranscribe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: FormData) => {
    if (!(d instanceof FormData)) throw new Error("Expected form data");
    const f = d.get("file");
    if (!(f instanceof Blob) || f.size === 0) throw new Error("No audio");
    if (f.size > 20 * 1024 * 1024) throw new Error("Audio too large (max 20 MB)");
    return { file: f };
  })
  .handler(async ({ data }) => {
    try {
      const blob = data.file as Blob;
      const file =
        blob instanceof File
          ? blob
          : new File([blob], "voice.webm", { type: blob.type || "audio/webm" });
      const form = new FormData();
      form.append("file", file);
      form.append("model", STT_MODEL);
      const res = await groqFetch("/audio/transcriptions", { method: "POST", body: form });
      const transcript = ((await res.json()) as { text?: string }).text ?? "";
      if (!transcript.trim()) return { transcript: "", summary: "", error: "No speech detected." };
      const summary = await run(TASKS.summarize, [{ role: "user", content: transcript }]);
      return { transcript, summary, error: null as string | null };
    } catch (e) {
      return { transcript: "", summary: "", error: friendly(e) };
    }
  });
