import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MODEL = "openai/gpt-5-mini" as const;
const FALLBACK_MODEL = "openai/gpt-5-nano" as const;

type Msg = { role: "user" | "assistant"; content: string };

function friendly(e: unknown): string {
  const name = (e as { name?: string })?.name ?? "";
  console.error("[v0] AI request failed", e);
  if (name.includes("RateLimit"))
    return "AI is busy right now. Please wait a moment and try again.";
  if (name.includes("PaymentRequired")) return "AI credits are used up for this workspace.";
  return "AI request failed. Please try again.";
}

async function run(instructions: string, input: Msg[]) {
  const { generateText, gateway } = await import("ai");
  const messages = input.map((m) => ({ role: m.role, content: m.content })) as Array<{
    role: "user" | "assistant";
    content: string;
  }>;
  try {
    const res = await generateText({
      model: gateway(MODEL),
      system: instructions,
      messages,
      maxRetries: 1,
    });
    return res.text;
  } catch (firstError) {
    console.warn("[v0] AI primary model failed; trying fallback", firstError);
    const res = await generateText({
      model: gateway(FALLBACK_MODEL),
      system: instructions,
      messages,
      maxRetries: 1,
    });
    return res.text;
  }
}

const COMPANION = `You are NEXORA's AI companion inside a Kenyan super-app (feeds, messages, maps, wallet, live, clubs, hub tools).
Be concise, warm and practical. Use markdown. Never claim to perform payments, send messages, or access live location; explain where in the app the user can do it.`;

export const aiChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { messages: Msg[] }) => {
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
  .inputValidator((d: { task: keyof typeof TASKS; text: string }) => {
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
  .inputValidator((d: FormData) => {
    if (!(d instanceof FormData)) throw new Error("Expected form data");
    const f = d.get("file");
    if (!(f instanceof Blob) || f.size === 0) throw new Error("No audio");
    if (f.size > 20 * 1024 * 1024) throw new Error("Audio too large (max 20 MB)");
    return { file: f };
  })
  .handler(async ({ data }) => {
    try {
      const { transcribeAudio } = await import("@lovable.dev/ai-gateway");
      const blob = data.file as Blob;
      const file =
        blob instanceof File
          ? blob
          : new File([blob], "voice.webm", { type: blob.type || "audio/webm" });
      const res = await transcribeAudio({ model: "openai/gpt-transcribe", file });
      const transcript = typeof res === "string" ? res : ((res as { text?: string }).text ?? "");
      if (!transcript.trim()) return { transcript: "", summary: "", error: "No speech detected." };
      const summary = await run(TASKS.summarize, [{ role: "user", content: transcript }]);
      return { transcript, summary, error: null as string | null };
    } catch (e) {
      return { transcript: "", summary: "", error: friendly(e) };
    }
  });
