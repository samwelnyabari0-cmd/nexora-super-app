import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactElement } from "react";
import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  Mic,
  MapPin,
  Timer,
  Trash2,
  Ghost,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader, DemoBadge, Panel } from "@/components/nexora/ui";
import { Button } from "@/components/ui/button";
import { fmtKES } from "@/features/core/data";
import { useApp } from "@/features/core/store";
import {
  allModules,
  splitBill,
  monthlyCost,
  nextRenewal,
  daysUntil,
  greeting,
  extractTasks,
  extractTags,
  type Cycle,
  type ModuleId,
} from "@/features/hub/logic";
import { useHub, newId, type HubData } from "@/features/hub/useHub";

export const Route = createFileRoute("/hub")({
  head: () => ({
    meta: [
      { title: "Hub — mini-apps, tasks & budget — NEXORA" },
      {
        name: "description",
        content:
          "Customisable mini-apps: tasks, notes, subscriptions, split bills, deals, focus timer and workflows, saved on your device.",
      },
      { property: "og:title", content: "NEXORA Hub" },
      {
        property: "og:description",
        content: "Tasks, notes, budget, deals and focus tools in one customisable hub.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HubPage,
});

const input = "w-full rounded-xl border bg-background px-3 py-2 text-sm";
type Update = (fn: (d: HubData) => HubData) => void;

function HubPage() {
  const hub = useHub();
  const { data, update } = hub;
  const { passport, online } = useApp();
  const [hour, setHour] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  useEffect(() => setHour(new Date().getHours()), []);
  const visible = data.modules.filter((m) => !data.hidden.includes(m));
  const move = (id: ModuleId, dir: -1 | 1) =>
    update((d) => {
      const a = [...d.modules];
      const i = a.indexOf(id),
        j = i + dir;
      if (j < 0 || j >= a.length) return d;
      [a[i], a[j]] = [a[j], a[i]];
      return { ...d, modules: a };
    });
  const toggle = (id: ModuleId) =>
    update((d) => ({
      ...d,
      hidden: d.hidden.includes(id) ? d.hidden.filter((x) => x !== id) : [...d.hidden, id],
    }));
  const q = query.toLowerCase();
  const results = q
    ? [
        ...data.tasks.map((t) => ({ k: "Task", t: t.text })),
        ...data.notes.map((n) => ({ k: "Note", t: n.text })),
      ].filter((r) => r.t.toLowerCase().includes(q))
    : [];
  const doneTasks = data.tasks.filter((t) => t.done).length;
  const monthly = data.subs.reduce((a, s) => a + monthlyCost(s.amount, s.cycle), 0);

  const blocks: Record<ModuleId, ReactElement> = {
    tasks: <Tasks data={data} update={update} />,
    notes: <Notes data={data} update={update} />,
    budget: <Budget data={data} update={update} />,
    deals: <Deals data={data} update={update} />,
    tools: <QuickTools />,
    focus: <Focus update={update} />,
    workflow: <Workflow update={update} />,
  };

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={hour === null ? "Hub" : `${greeting(hour)}, ${passport.name.split(" ")[0]}`}
        subtitle="Your mini-apps. Saved on this device only — not synced to a cloud account."
        action={<DemoBadge>Device only</DemoBadge>}
      />
      <div
        className={`mb-4 flex flex-wrap items-center gap-3 rounded-2xl border p-3 ${hub.ghostOn ? "border-warning/60 bg-warning/10" : ""}`}
      >
        <Ghost className="h-5 w-5" aria-hidden />
        <p className="flex-1 text-sm">
          {hub.ghostOn
            ? "Ghost State on: changes are temporary and not saved until you commit."
            : "Ghost State: try changes in a temporary sandbox, then commit or discard."}
        </p>
        {hub.ghostOn ? (
          <>
            <Button
              size="sm"
              onClick={() => {
                hub.commitGhost();
                toast.success("Ghost changes committed to this device");
              }}
            >
              Commit
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                hub.discardGhost();
                toast("Ghost changes discarded");
              }}
            >
              Discard
            </Button>
          </>
        ) : (
          <Button size="sm" variant="outline" onClick={hub.enterGhost}>
            Enter Ghost State
          </Button>
        )}
        <span className="text-xs text-muted-foreground">
          {online ? "Online" : "Offline — everything here still works"}
        </span>
      </div>
      <div className="mb-4 flex gap-2">
        <input
          aria-label="Search tasks and notes"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search tasks & notes, or use voice"
          className={input}
        />
        <VoiceButton onText={setQuery} />
      </div>
      {q && (
        <Panel className="mb-4">
          {results.length ? (
            <ul className="text-sm">
              {results.map((r, i) => (
                <li key={i} className="border-b py-1.5">
                  <b className="text-accent">{r.k}</b> · {r.t}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No matches.</p>
          )}
        </Panel>
      )}
      <Panel className="mb-6">
        <p className="mb-2 font-display font-semibold">Value Ledger</p>
        <div className="grid grid-cols-3 gap-3 text-center text-sm">
          <div>
            <p className="text-2xl font-bold">
              {doneTasks}/{data.tasks.length}
            </p>
            <p className="text-muted-foreground">tasks done</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{data.focusMinutes}</p>
            <p className="text-muted-foreground">focus minutes</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{fmtKES(monthly)}</p>
            <p className="text-muted-foreground">subscriptions / month</p>
          </div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Counted only from what you entered here.
        </p>
      </Panel>
      <details className="mb-6 rounded-2xl border p-3">
        <summary className="cursor-pointer font-semibold">
          Mini-App Store — show, hide and reorder
        </summary>
        <ul className="mt-3 space-y-1">
          {data.modules.map((id, i) => {
            const m = allModules.find((x) => x.id === id)!;
            const off = data.hidden.includes(id);
            return (
              <li key={id} className="flex items-center gap-2 border-b py-1.5 text-sm">
                <span className="flex-1">{m.label}</span>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Move ${m.label} up`}
                  disabled={i === 0}
                  onClick={() => move(id, -1)}
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Move ${m.label} down`}
                  disabled={i === data.modules.length - 1}
                  onClick={() => move(id, 1)}
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={off ? `Show ${m.label}` : `Hide ${m.label}`}
                  onClick={() => toggle(id)}
                >
                  {off ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </li>
            );
          })}
        </ul>
      </details>
      <div className="grid gap-4 md:grid-cols-2">
        {visible.map((id) => (
          <Panel key={id}>{blocks[id]}</Panel>
        ))}
      </div>
      <Panel className="mt-6 text-sm text-muted-foreground">
  <p className="mb-1 font-semibold text-foreground">Connected service actions</p>
  Sign in for Supabase cloud sync, use Paystack for verified checkout, Google Maps and Calendar for club coordination, and Jitsi for live video rooms.
      </Panel>
    </div>
  );
}

function Title({ children, badge }: { children: string; badge?: string }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="font-display font-semibold">{children}</h2>
      {badge && <DemoBadge>{badge}</DemoBadge>}
    </div>
  );
}

function Tasks({ data, update }: { data: HubData; update: Update }) {
  const [t, setT] = useState("");
  const add = () => {
    if (!t.trim()) return;
    update((d) => ({ ...d, tasks: [{ id: newId(), text: t.trim(), done: false }, ...d.tasks] }));
    setT("");
  };
  return (
    <>
      <Title>Tasks</Title>
      <form
        className="mb-2 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <input
          aria-label="New task"
          value={t}
          onChange={(e) => setT(e.target.value)}
          placeholder="Add a task"
          className={input}
        />
        <Button type="submit">Add</Button>
      </form>
      {data.tasks.length ? (
        <ul>
          {data.tasks.map((x) => (
            <li key={x.id} className="flex items-center gap-2 py-1 text-sm">
              <input
                type="checkbox"
                aria-label={`Done: ${x.text}`}
                checked={x.done}
                onChange={() =>
                  update((d) => ({
                    ...d,
                    tasks: d.tasks.map((y) => (y.id === x.id ? { ...y, done: !y.done } : y)),
                  }))
                }
              />
              <span className={`flex-1 ${x.done ? "line-through text-muted-foreground" : ""}`}>
                {x.text}
              </span>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Delete task"
                onClick={() =>
                  update((d) => ({ ...d, tasks: d.tasks.filter((y) => y.id !== x.id) }))
                }
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No tasks yet.</p>
      )}
    </>
  );
}

function Notes({ data, update }: { data: HubData; update: Update }) {
  const [t, setT] = useState("");
  const items = extractTasks(t),
    tags = extractTags(t);
  return (
    <>
      <Title>Notes</Title>
      <textarea
        aria-label="Note"
        value={t}
        onChange={(e) => setT(e.target.value)}
        rows={4}
        placeholder="Paste text or write a note. Use #tags and - bullets."
        className={input}
      />
      {t && (
        <div className="mt-2 rounded-xl bg-muted/40 p-2 text-xs">
          <p className="font-semibold">Quick extract (rule-based, not AI)</p>
          <p>
            {t.trim().split(/\s+/).length} words · Tags: {tags.join(", ") || "none"}
          </p>
          {items.length > 0 && (
            <ul className="list-disc pl-4">
              {items.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          )}
          <p className="mt-1 text-muted-foreground">
            AI summaries need an AI provider connected — not active.
          </p>
        </div>
      )}
      <div className="mt-2 flex gap-2">
        <Button
          disabled={!t.trim()}
          onClick={() => {
            update((d) => ({
              ...d,
              notes: [{ id: newId(), text: t.trim(), at: Date.now() }, ...d.notes],
            }));
            setT("");
          }}
        >
          Save note
        </Button>
        <Button
          variant="outline"
          disabled={!items.length}
          onClick={() => {
            update((d) => ({
              ...d,
              tasks: [...items.map((text) => ({ id: newId(), text, done: false })), ...d.tasks],
            }));
            toast.success(`${items.length} tasks added`);
          }}
        >
          Send items to Tasks
        </Button>
      </div>
      <ul className="mt-3 max-h-48 overflow-y-auto text-sm">
        {data.notes.map((n) => (
          <li key={n.id} className="flex gap-2 border-b py-1.5">
            <span className="flex-1 whitespace-pre-wrap">{n.text}</span>
            <Button
              size="icon"
              variant="ghost"
              aria-label="Delete note"
              onClick={() => update((d) => ({ ...d, notes: d.notes.filter((y) => y.id !== n.id) }))}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </li>
        ))}
      </ul>
    </>
  );
}

function Budget({ data, update }: { data: HubData; update: Update }) {
  const [name, setName] = useState("");
  const [amt, setAmt] = useState("");
  const [cycle, setCycle] = useState<Cycle>("monthly");
  const [start, setStart] = useState("");
  const [total, setTotal] = useState("");
  const [people, setPeople] = useState("2");
  const [today, setToday] = useState<Date | null>(null);
  useEffect(() => setToday(new Date()), []);
  const shares = splitBill(Number(total), Number(people));
  return (
    <>
      <Title badge="Manual entries">Budget & subscriptions</Title>
      <form
        className="grid grid-cols-2 gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const a = Number(amt);
          if (!name.trim() || !(a > 0) || !start) {
            toast.error("Enter a name, amount and start date");
            return;
          }
          update((d) => ({
            ...d,
            subs: [...d.subs, { id: newId(), name: name.trim(), amount: a, cycle, start }],
          }));
          setName("");
          setAmt("");
        }}
      >
        <input
          aria-label="Subscription name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Gym"
          className={input}
        />
        <input
          aria-label="Amount KES"
          inputMode="decimal"
          value={amt}
          onChange={(e) => setAmt(e.target.value.replace(/[^\d.]/g, ""))}
          placeholder="KES"
          className={input}
        />
        <select
          aria-label="Billing cycle"
          value={cycle}
          onChange={(e) => setCycle(e.target.value as Cycle)}
          className={input}
        >
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
          <option value="yearly">Yearly</option>
        </select>
        <input
          aria-label="Start date"
          type="date"
          value={start}
          onChange={(e) => setStart(e.target.value)}
          className={input}
        />
        <Button type="submit" className="col-span-2">
          Add subscription
        </Button>
      </form>
      <ul className="mt-2 text-sm">
        {today &&
          data.subs.map((s) => {
            const n = nextRenewal(s.start, s.cycle, today);
            const days = daysUntil(n, today);
            return (
              <li key={s.id} className="flex items-center gap-2 border-b py-1.5">
                <span className="flex-1">
                  {s.name} · {fmtKES(s.amount)}/{s.cycle.replace("ly", "")}
                </span>
                <span className={days <= 3 ? "text-warning" : "text-muted-foreground"}>
                  {days === 0 ? "due today" : `in ${days}d`}
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Delete ${s.name}`}
                  onClick={() =>
                    update((d) => ({ ...d, subs: d.subs.filter((x) => x.id !== s.id) }))
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            );
          })}
      </ul>
      <p className="mt-1 text-xs text-muted-foreground">
        Reminders show here when renewals are 3 days away. No bank is connected.
      </p>
      <div className="mt-4 border-t pt-3">
        <p className="mb-2 text-sm font-semibold">
          Split a bill{" "}
          <span className="text-xs text-warning">(calculator only — no money moves)</span>
        </p>
        <div className="flex gap-2">
          <input
            aria-label="Bill total"
            inputMode="decimal"
            value={total}
            onChange={(e) => setTotal(e.target.value.replace(/[^\d.]/g, ""))}
            placeholder="Total KES"
            className={input}
          />
          <input
            aria-label="People"
            type="number"
            min={1}
            max={50}
            value={people}
            onChange={(e) => setPeople(e.target.value)}
            className={`${input} w-20`}
          />
        </div>
        {shares.length > 0 && (
          <p className="mt-2 text-sm">Each pays: {[...new Set(shares)].map(fmtKES).join(" or ")}</p>
        )}
      </div>
    </>
  );
}

const deals = [
  { name: "Two-for-one coffee", place: "Java House", city: "Nairobi" },
  { name: "Phone screen repair -15%", place: "FixIt Westlands", city: "Nairobi" },
  { name: "Ferry-side lunch special", place: "Old Town Café", city: "Mombasa" },
  { name: "Verified plumber callout", place: "PipePro", city: "Kisumu" },
  { name: "Matatu art tour", place: "Nakuru Walks", city: "Nakuru" },
];
function Deals({ data, update }: { data: HubData; update: Update }) {
  const [status, setStatus] = useState("");
  const locate = () => {
    if (!navigator.geolocation) {
      setStatus("Location isn't supported here — pick a city.");
      return;
    }
    setStatus("Asking for permission…");
    navigator.geolocation.getCurrentPosition(
      (p) =>
        setStatus(
          `Location received (${p.coords.latitude.toFixed(2)}, ${p.coords.longitude.toFixed(2)}). Sample listings aren't geo-matched yet — pick your city.`,
        ),
      (e) =>
        setStatus(
          e.code === 1
            ? "Location permission denied — pick a city instead."
            : "Couldn't get location — pick a city.",
        ),
      { timeout: 8000 },
    );
  };
  return (
    <>
      <Title badge="Sample listings">Deals & verified services</Title>
      <div className="flex gap-2">
        <select
          aria-label="City"
          value={data.city}
          onChange={(e) => update((d) => ({ ...d, city: e.target.value }))}
          className={input}
        >
          {["Nairobi", "Mombasa", "Kisumu", "Nakuru"].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <Button variant="outline" onClick={locate}>
          <MapPin className="h-4 w-4" /> Use location
        </Button>
      </div>
      {status && (
        <p role="status" className="mt-2 text-xs text-muted-foreground">
          {status}
        </p>
      )}
      <ul className="mt-2 text-sm">
        {deals
          .filter((d) => d.city === data.city)
          .map((d) => (
            <li key={d.name} className="border-b py-1.5">
              {d.name} · <span className="text-muted-foreground">{d.place}</span>
            </li>
          ))}
      </ul>
      <p className="mt-1 text-xs text-muted-foreground">
        Sample data; "verified" is not checked by anyone yet.
      </p>
    </>
  );
}

function QuickTools() {
  const [kes, setKes] = useState("");
  const [tip, setTip] = useState("10");
  return (
    <>
      <Title>Quick tools</Title>
           <label className="text-sm">Tip calculator</label>
      <div className="flex gap-2">
        <input
          aria-label="Bill KES"
          inputMode="decimal"
          value={kes}
          onChange={(e) => setKes(e.target.value.replace(/[^\d.]/g, ""))}
          placeholder="Bill KES"
          className={input}
        />
        <input
          aria-label="Tip percent"
          type="number"
          value={tip}
          onChange={(e) => setTip(e.target.value)}
          className={`${input} w-20`}
        />
      </div>
      {Number(kes) > 0 && (
        <p className="mt-2 text-sm">
          Tip {fmtKES((Number(kes) * Number(tip)) / 100)} · Total{" "}
          {fmtKES(Number(kes) * (1 + Number(tip) / 100))}
        </p>
      )}
    </>
  );
}

function Focus({ update }: { update: Update }) {
  const [left, setLeft] = useState(25 * 60);
  const [run, setRun] = useState(false);
  useEffect(() => {
    if (!run) return;
    const t = setInterval(() => setLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [run]);
  useEffect(() => {
    if (left <= 0) {
      setRun(false);
      setLeft(25 * 60);
      update((d) => ({ ...d, focusMinutes: d.focusMinutes + 25 }));
      toast.success("Focus session done — 25 minutes logged");
    }
  }, [left, update]);
  return (
    <>
      <Title badge="Solo, local">Focus timer</Title>
      <p className="text-center font-display text-5xl font-bold tabular-nums" aria-live="polite">
        {String(Math.floor(left / 60)).padStart(2, "0")}:{String(left % 60).padStart(2, "0")}
      </p>
      <div className="mt-3 flex justify-center gap-2">
        <Button onClick={() => setRun(!run)}>
          <Timer className="h-4 w-4" />
          {run ? "Pause" : "Start"}
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            setRun(false);
            setLeft(25 * 60);
          }}
        >
          Reset
        </Button>
      </div>
      <p className="mt-2 text-center text-xs text-muted-foreground">
        Shared co-op rooms need a realtime backend — not connected.
      </p>
    </>
  );
}

function Workflow({ update }: { update: Update }) {
  const [text, setText] = useState("");
  const [out, setOut] = useState<string[] | null>(null);
  return (
    <>
      <Title>Micro-Split workflow</Title>
      <p className="mb-2 text-xs text-muted-foreground">
        Voice or text → Extract action items → Tasks. Runs locally; nothing saves until you commit.
      </p>
      <div className="flex gap-2">
        <textarea
          aria-label="Workflow input"
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Dictate or type: call the landlord. - buy data bundle"
          className={input}
        />
        <VoiceButton onText={(t) => setText((x) => `${x} ${t}`.trim())} />
      </div>
      <div className="mt-2 flex gap-2">
        <Button
          variant="outline"
          disabled={!text.trim()}
          onClick={() => setOut(extractTasks(text))}
        >
          Run
        </Button>
        <Button
          disabled={!out?.length}
          onClick={() => {
            update((d) => ({
              ...d,
              tasks: [...out!.map((t) => ({ id: newId(), text: t, done: false })), ...d.tasks],
            }));
            toast.success("Committed to Tasks");
            setOut(null);
            setText("");
          }}
        >
          Commit
        </Button>
      </div>
      {out && (
        <p className="mt-2 text-sm">
          {out.length
            ? out.join(" · ")
            : "No action items found. Start lines with '-' or a verb like call, buy, send."}
        </p>
      )}
    </>
  );
}

type SpeechCtor = new () => {
  lang: string;
  interimResults: boolean;
  onresult: (e: { results: { 0: { transcript: string } }[] }) => void;
  onerror: (e: { error: string }) => void;
  onend: () => void;
  start(): void;
};
function VoiceButton({ onText }: { onText: (t: string) => void }) {
  const [on, setOn] = useState(false);
  const Ctor = useMemo<SpeechCtor | undefined>(
    () =>
      typeof window === "undefined"
        ? undefined
        : ((window as unknown as Record<string, SpeechCtor>).SpeechRecognition ??
          (window as unknown as Record<string, SpeechCtor>).webkitSpeechRecognition),
    [],
  );
  const start = () => {
    if (!Ctor) {
      toast.error("Voice input isn't supported in this browser — type instead.");
      return;
    }
    const r = new Ctor();
    r.lang = "en-KE";
    r.interimResults = false;
    r.onresult = (e) => onText(e.results[0]?.[0].transcript ?? "");
    r.onerror = (e) =>
      toast.error(
        e.error === "not-allowed"
          ? "Microphone permission denied."
          : "Voice input failed — type instead.",
      );
    r.onend = () => setOn(false);
    setOn(true);
    r.start();
  };
  return (
    <Button
      type="button"
      variant={on ? "default" : "outline"}
      size="icon"
      aria-label="Voice input"
      onClick={start}
    >
      <Mic className="h-4 w-4" />
    </Button>
  );
} 
