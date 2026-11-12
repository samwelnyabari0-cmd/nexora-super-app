import { AIStudioHistory } from "@/components/nexora/AIStudioHistory";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import ReactMarkdown from "react-markdown";
import {
  Send,
  Copy,
  Trash2,
  Bot,
  FileText,
  Clapperboard,
  Mic,
  Square,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Chip, PageHeader } from "@/components/nexora/ui";
import { cn } from "@/lib/utils";
import { useSession } from "@/lib/session";
import { aiChat, aiTask, aiTranscribe } from "@/lib/ai.functions";

export const Route = createFileRoute("/ai")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "AI Studio — NEXORA" },
      {
        name: "description",
        content:
          "AI companion, summarizer, creator copilot and voice-note transcriber powered by OpenAI.",
      },
      { property: "og:title", content: "AI Studio — NEXORA" },
      {
        property: "og:description",
        content: "Chat, summarize, write captions and transcribe voice notes with AI.",
      },
    ],
  }),
  component: AIPage,
});

type Tab = "chat" | "summarize" | "caption" | "voice";
const TABS: { id: Tab; label: string; icon: typeof Bot }[] = [
  { id: "chat", label: "Companion", icon: Bot },
  { id: "summarize", label: "Summarizer", icon: FileText },
  { id: "caption", label: "Creator Copilot", icon: Clapperboard },
  { id: "voice", label: "Voice notes", icon: Mic },
];

function copy(text: string) {
  navigator.clipboard.writeText(text).then(
    () => toast.success("Copied"),
    () => toast.error("Clipboard unavailable"),
  );
}

function AIPage() {
  const session = useSession();
  const [tab, setTab] = useState<Tab>("chat");
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="AI Studio"
        subtitle="Powered by OpenAI through Vercel AI Gateway · double-check important info"
      />
      <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto" role="tablist">
        {TABS.map((t) => (
          <Chip key={t.id} active={tab === t.id} onClick={() => setTab(t.id)}>
            <t.icon className="mr-1 inline h-3.5 w-3.5" />
            {t.label}
          </Chip>
        ))}
      </div>
      {!session.user && session.ready ? (
        <div className="rounded-2xl border bg-card p-6 text-center">
          <p className="mb-3 font-semibold">Sign in to use AI tools</p>
          <p className="mb-4 text-sm text-muted-foreground">
            AI runs on real servers, so we require an account to prevent abuse.
          </p>
          <Button asChild className="bg-brand text-primary-foreground">
            <Link to="/auth">Sign in with Google</Link>
          </Button>
        </div>
      ) : tab === "chat" ? (
        <Chat />
      ) : tab === "voice" ? (
        <Voice />
      ) : (
        <TaskTool key={tab} task={tab} />
      )}
    </div>
  );
}

type M = { role: "user" | "assistant"; content: string };
function Chat() {
  const chat = useServerFn(aiChat);
  const [msgs, setMsgs] = useState<M[]>([]);
  const [t, setT] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ask = async (q: string) => {
    if (!q.trim() || busy) return;
    const next = [...msgs, { role: "user" as const, content: q }];
    setMsgs(next);
    setT("");
    setError("");
    setBusy(true);
    try {
      const r = await chat({ data: { messages: next } });
      if (r.error) setError(r.error);
      else setMsgs((m) => [...m, { role: "assistant", content: r.text }]);
    } catch {
      setError("AI request failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="mb-2 flex justify-end">
        <Button
          size="sm"
          variant="ghost"
          disabled={busy || !msgs.length}
          onClick={() => setMsgs([])}
        >
          <Trash2 className="mr-1 h-4 w-4" /> New chat
        </Button>
      </div>
      <div className="mb-3 space-y-3" aria-live="polite">
        {!msgs.length && (
          <p className="rounded-2xl border bg-card p-4 text-sm text-muted-foreground">
            Ask anything — plan your day, draft a message, get ideas for Nairobi weekends.
          </p>
        )}
        {msgs.map((m, i) => (
          <div
            key={i}
            className={cn(
              "max-w-[88%] rounded-2xl px-4 py-3 text-sm",
              m.role === "user" ? "bg-brand ml-auto text-primary-foreground" : "",
            )}
          >
            {m.role === "assistant" ? (
              <>
                <span className="mb-1 flex items-center gap-1 text-[11px] font-semibold uppercase text-accent">
                  <Bot className="h-3 w-3" /> Nexora AI
                </span>
                <div className="prose prose-sm prose-invert max-w-none">
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="mt-1 h-7 px-2"
                  onClick={() => copy(m.content)}
                >
                  <Copy className="mr-1 h-3.5 w-3.5" /> Copy
                </Button>
              </>
            ) : (
              m.content
            )}
          </div>
        ))}
        {busy && <p className="animate-pulse text-sm text-muted-foreground">Thinking…</p>}
      </div>
      {error && (
        <p role="alert" className="mb-3 text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="no-scrollbar mb-3 flex gap-2 overflow-x-auto">
        {[
          "Plan my Saturday in Nairobi",
          "Write a birthday message",
          "Budget tips for students",
        ].map((s) => (
          <Chip key={s} onClick={() => ask(s)}>
            {s}
          </Chip>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(t);
        }}
        className="flex gap-2"
      >
        <label htmlFor="ai-input" className="sr-only">
          Message
        </label>
        <input
          id="ai-input"
          autoFocus
          value={t}
          onChange={(e) => setT(e.target.value)}
          placeholder="Ask anything…"
          className="min-w-0 flex-1 rounded-full border bg-card px-4 py-2.5 text-sm"
        />
        <Button
          disabled={busy || !t.trim()}
          aria-label="Send"
          size="icon"
          className="bg-brand h-11 w-11 shrink-0 rounded-full text-primary-foreground"
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </>
  );
}

function Result({ text }: { text: string }) {
  return (
    <div className="mt-4 rounded-2xl border bg-card p-4 text-sm">
      <div className="prose prose-sm prose-invert max-w-none">
        <ReactMarkdown>{text}</ReactMarkdown>
      </div>
      <Button size="sm" variant="ghost" className="mt-2" onClick={() => copy(text)}>
        <Copy className="mr-1 h-3.5 w-3.5" /> Copy
      </Button>
    </div>
  );
}


function TaskTool({ task }: { task: "summarize" | "caption" }) {
  const run = useServerFn(aiTask);
  const session = useSession();

  const [text, setText] = useState("");
  const [out, setOut] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [historyDraft, setHistoryDraft] = useState<{
    prompt: string;
    mode: "summarize" | "caption";
    resultPreview?: string;
    savedAt: number;
  } | null>(null);

  const go = async () => {
    if (!text.trim() || busy) return;

    setBusy(true);
    setError("");
    setOut("");

    try {
      const promptUsed = text.trim();
      const r = await run({ data: { task, text: promptUsed } });

      if (r.error) {
        setError(r.error);
      } else {
        setOut(r.text);
        setHistoryDraft({
          prompt: promptUsed,
          mode: task,
          resultPreview: r.text,
          savedAt: Date.now(),
        });
      }
    } catch {
      setError("AI request failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const onFile = async (f?: File) => {
    if (!f) return;

    if (f.size > 500_000) {
      toast.error("File too large — paste up to ~500 KB of text.");
      return;
    }

    setText(await f.text());
  };

  return (
    <div>
      <label htmlFor="task-in" className="mb-2 block text-sm font-medium">
        {task === "summarize"
          ? "Paste notes, an article or a document"
          : "Describe your video or post idea"}
      </label>

      <textarea
        id="task-in"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={8}
        placeholder={
          task === "summarize"
            ? "Paste long text here…"
            : "e.g. A day exploring street food in Nairobi CBD under KES 500"
        }
        className="w-full rounded-2xl border bg-card p-3 text-sm"
      />

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button
          disabled={busy || !text.trim()}
          onClick={go}
          className="bg-brand text-primary-foreground"
        >
          {busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
          {task === "summarize" ? "Summarize" : "Generate captions"}
        </Button>

        {task === "summarize" && (
          <label className="cursor-pointer text-sm text-accent underline">
            Upload .txt / .md
            <input
              type="file"
              accept=".txt,.md,text/plain,text/markdown"
              className="sr-only"
              onChange={(e) => onFile(e.target.files?.[0])}
            />
          </label>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {out && <Result text={out} />}

      <AIStudioHistory
        userId={session.user?.id}
        mode={task}
        draft={historyDraft}
        onReuse={(prompt) => {
          setText(prompt);
          setOut("");
          setError("");
        }}
      />
    </div>
  );
          }


function Voice() {
  const run = useServerFn(aiTranscribe);
  const rec = useRef<MediaRecorder | null>(null);
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [res, setRes] = useState<{ transcript: string; summary: string } | null>(null);

  const send = async (blob: Blob, name: string) => {
    setBusy(true);
    setError("");
    setRes(null);
    try {
      const fd = new FormData();
      fd.append("file", new File([blob], name, { type: blob.type || "audio/webm" }));
      const r = await run({ data: fd });
      if (r.error) setError(r.error);
      else setRes({ transcript: r.transcript, summary: r.summary });
    } catch {
      setError("Transcription failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };
  const start = async () => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      mr.ondataavailable = (e) => chunks.push(e.data);
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        send(new Blob(chunks, { type: mr.mimeType }), "voice.webm");
      };
      mr.start();
      rec.current = mr;
      setRecording(true);
    } catch {
      setError("Microphone blocked or unavailable. Allow mic access or upload an audio file.");
    }
  };
  const stop = () => {
    rec.current?.stop();
    setRecording(false);
  };

  return (
    <div className="rounded-2xl border bg-card p-5">
      <p className="mb-4 text-sm text-muted-foreground">
        Record or upload a voice note — get a transcript plus summary, action items and tags.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        {recording ? (
          <Button onClick={stop} variant="destructive">
            <Square className="mr-1 h-4 w-4" /> Stop & transcribe
          </Button>
        ) : (
          <Button onClick={start} disabled={busy} className="bg-brand text-primary-foreground">
            <Mic className="mr-1 h-4 w-4" /> Record
          </Button>
        )}
        <label className="cursor-pointer text-sm text-accent underline">
          Upload audio
          <input
            type="file"
            accept="audio/*"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) send(f, f.name);
            }}
          />
        </label>
        {recording && <span className="animate-pulse text-sm text-destructive">● Recording…</span>}
        {busy && (
          <span className="flex items-center text-sm text-muted-foreground">
            <Loader2 className="mr-1 h-4 w-4 animate-spin" /> Transcribing…
          </span>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      )}
      {res && (
        <>
          <div className="mt-4 rounded-xl border p-3 text-sm">
            <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Transcript</p>
            <p className="whitespace-pre-line">{res.transcript}</p>
          </div>
          <Result text={res.summary} />
        </>
      )}
    </div>
  );
}
