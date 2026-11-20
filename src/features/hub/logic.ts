// Pure helpers for the Hub mini-apps. No network, no AI.
export type ModuleId =
  "tasks" | "notes" | "budget" | "deals" | "tools" | "focus" | "workflow";
export type ModuleAccent = "emerald" | "cyan" | "violet" | "indigo" | "slate" | "amber";

export const moduleBranding: Record<
  ModuleId,
  { name: string; feature: string; accent: ModuleAccent; description: string }
> = {
  budget: {
    name: "PesaVault",
    feature: "Subscriptions & bills",
    accent: "emerald",
    description: "Keep recurring costs visible and organised.",
  },
  tools: {
    name: "ShareTab",
    feature: "Split bills",
    accent: "cyan",
    description: "Share a bill and calculate fair contributions.",
  },
  focus: {
    name: "DeepPulse",
    feature: "Focus timer",
    accent: "violet",
    description: "Protect focused time, one session at a time.",
  },
  workflow: {
    name: "TaskForge",
    feature: "Micro-workflows",
    accent: "indigo",
    description: "Turn a big goal into manageable steps.",
  },
  notes: {
    name: "MindGrid",
    feature: "Notes",
    accent: "slate",
    description: "Capture thoughts and turn useful notes into actions.",
  },
  tasks: {
    name: "MindGrid",
    feature: "Tasks",
    accent: "slate",
    description: "Keep your next actions clear and organised.",
  },
  deals: {
    name: "TrustSpot",
    feature: "Deals & services",
    accent: "amber",
    description: "Browse local services and clearly labelled listings.",
  },
};

export const allModules: { id: ModuleId; label: string }[] = [
  { id: "tasks", label: "MindGrid · Tasks" },
  { id: "notes", label: "MindGrid · Notes" },
  { id: "budget", label: "PesaVault" },
  { id: "deals", label: "TrustSpot" },
  { id: "tools", label: "ShareTab" },
  { id: "focus", label: "DeepPulse" },
  { id: "workflow", label: "TaskForge" },
];

/** Split an amount in KES cents fairly; leftover cents go to the first people. */
export function splitBill(total: number, people: number): number[] {
  if (!(total > 0) || !Number.isInteger(people) || people < 1) return [];
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / people),
    rest = cents % people;
  return Array.from({ length: people }, (_, i) => (base + (i < rest ? 1 : 0)) / 100);
}

export type Cycle = "weekly" | "monthly" | "yearly";
export function monthlyCost(amount: number, cycle: Cycle) {
  return cycle === "weekly" ? (amount * 52) / 12 : cycle === "yearly" ? amount / 12 : amount;
}
/** Next renewal on/after `today` for a subscription starting on `start` (YYYY-MM-DD). */
export function nextRenewal(start: string, cycle: Cycle, today: Date): Date {
  const d = new Date(start + "T00:00:00");
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  let guard = 0;
  while (d < t && guard++ < 5000) {
    if (cycle === "weekly") d.setDate(d.getDate() + 7);
    else if (cycle === "monthly") d.setMonth(d.getMonth() + 1);
    else d.setFullYear(d.getFullYear() + 1);
  }
  return d;
}
export function daysUntil(d: Date, today: Date) {
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((d.getTime() - t.getTime()) / 86400000);
}

export function greeting(hour: number) {
  return hour < 5
    ? "Late night"
    : hour < 12
      ? "Good morning"
      : hour < 17
        ? "Good afternoon"
        : "Good evening";
}

/** Rule-based (not AI) extraction: lines starting with -, *, [ ], "todo", or imperative verbs. */
export function extractTasks(text: string): string[] {
  const verbs =
    /^(call|email|send|buy|book|pay|finish|review|write|plan|schedule|fix|check|follow up)\b/i;
  return text
    .split(/\n|(?<=[.!?])\s+/)
    .map((l) => l.trim())
    .map((l) => l.replace(/^([-*•]|\[ ?\]|todo:?)\s*/i, (m) => (m ? "\u0000" : "")))
    .filter((l) => l.startsWith("\u0000") || verbs.test(l))
    .map((l) => l.replace("\u0000", "").trim())
    .filter(Boolean);
}
export function extractTags(text: string): string[] {
  return [...new Set((text.match(/#[\p{L}\d_]+/gu) ?? []).map((t) => t.slice(1).toLowerCase()))];
}
