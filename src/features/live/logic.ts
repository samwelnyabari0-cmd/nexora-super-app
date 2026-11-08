// Pure, testable logic for live, growth and platform features. No network calls.

export type LiveStream = {
  id: string;
  creator: string;
  title: string;
  viewers: number;
  place?: string;
  x: number;
  y: number;
  startedAt: number;
  sponsored?: boolean;
};

export const seedLive: LiveStream[] = [
  {
    id: "l1",
    creator: "Amani Otieno",
    title: "Sunset set at the rooftop",
    viewers: 1840,
    place: "Westlands Rooftop",
    x: 32,
    y: 40,
    startedAt: Date.now() - 22 * 60e3,
  },
  {
    id: "l2",
    creator: "Wanjiku Eats",
    title: "Street food crawl — Q&A",
    viewers: 620,
    place: "River Road Market",
    x: 58,
    y: 62,
    startedAt: Date.now() - 8 * 60e3,
    sponsored: true,
  },
  {
    id: "l3",
    creator: "Zuri Motion",
    title: "Coding a mini-app live",
    viewers: 312,
    x: 74,
    y: 28,
    startedAt: Date.now() - 41 * 60e3,
  },
];

/** LIVE creators come first, then by viewer count. */
export function prioritizeLive<T extends { name: string }>(
  people: T[],
  live: LiveStream[],
): (T & { live?: LiveStream })[] {
  return people
    .map((p) => ({ ...p, live: live.find((l) => l.creator === p.name) }))
    .sort((a, b) => (b.live?.viewers ?? -1) - (a.live?.viewers ?? -1));
}

/** Validate a tip amount (KES). Returns an error message or null. */
export function tipError(amount: number, balance: number): string | null {
  if (!Number.isFinite(amount) || amount <= 0) return "Enter an amount above KES 0.";
  if (amount < 10) return "The smallest tip is KES 10.";
  if (amount > 10000) return "Tips are capped at KES 10,000 each.";
  if (amount > balance) return "Not enough demo balance.";
  return null;
}

/** Split a gross amount into platform fee and creator share. feePct clamped 0–50. */
export function feeSplit(gross: number, feePct: number) {
  const pct = Math.min(50, Math.max(0, feePct));
  const fee = Math.round(gross * pct) / 100;
  return { fee, creator: Math.round((gross - fee) * 100) / 100, pct };
}

/** Pay-per-second cost estimate. */
export function perSecondCost(seconds: number, ratePerMinute: number) {
  return Math.round(((Math.max(0, seconds) * Math.max(0, ratePerMinute)) / 60) * 100) / 100;
}

/** Monthly subscription estimate (gross, before fees). An estimate, never a guarantee. */
export function subscriptionEstimate(subscribers: number, price: number, feePct: number) {
  return feeSplit(Math.max(0, subscribers) * Math.max(0, price), feePct);
}

/** Sponsored pin cost = impressions/1000 × CPM. */
export function sponsoredPinCost(impressions: number, cpm: number) {
  return Math.round((Math.max(0, impressions) / 1000) * Math.max(0, cpm) * 100) / 100;
}

/** Streak: consecutive days (ending today or yesterday) that include a check-in. Dates are YYYY-MM-DD. */
export function streak(days: string[], today: string): number {
  const set = new Set(days);
  const d = new Date(today + "T00:00:00Z");
  if (!set.has(today)) d.setUTCDate(d.getUTCDate() - 1);
  let n = 0;
  while (set.has(d.toISOString().slice(0, 10))) {
    n++;
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return n;
}

export type Tip = { from: string; to: string; amount: number; verified: boolean };
/** Leaderboard only counts tips marked verified (in this demo, ones you sent yourself). */
export function leaderboard(tips: Tip[]) {
  const totals = new Map<string, number>();
  for (const t of tips) if (t.verified) totals.set(t.from, (totals.get(t.from) ?? 0) + t.amount);
  return [...totals.entries()]
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total);
}

export type Poll = { question: string; options: { label: string; votes: number }[] };
export function vote(poll: Poll, index: number): Poll {
  return {
    ...poll,
    options: poll.options.map((o, i) => (i === index ? { ...o, votes: o.votes + 1 } : o)),
  };
}

// Typed event bus
export type NexoraEvents = {
  "live:start": { title: string };
  "live:end": { seconds: number };
  "tip:sent": { to: string; amount: number };
  "checkin:made": { place: string };
  "act:preset": { name: string };
  "bandwidth:change": { low: boolean };
};
type Handler<T> = (payload: T) => void;
export function createEventBus<E extends Record<string, unknown>>() {
  const map = new Map<keyof E, Set<Handler<never>>>();
  return {
    on<K extends keyof E>(k: K, h: Handler<E[K]>) {
      if (!map.has(k)) map.set(k, new Set());
      map.get(k)!.add(h as Handler<never>);
      return () => {
        map.get(k)!.delete(h as Handler<never>);
      };
    },
    emit<K extends keyof E>(k: K, payload: E[K]) {
      map.get(k)?.forEach((h) => (h as Handler<E[K]>)(payload));
    },
  };
}
export const bus = createEventBus<NexoraEvents>();

/** Data export payload for portability. */
export function exportBundle(data: Record<string, unknown>) {
  return JSON.stringify(
    { app: "NEXORA", version: 1, exportedAt: new Date().toISOString(), data },
    null,
    2,
  );
}
