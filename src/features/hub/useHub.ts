import { useCallback, useEffect, useRef, useState } from "react";
import type { Cycle, ModuleId } from "./logic";
import { allModules } from "./logic";
import { supabase } from "@/integrations/supabase/client";
import { currentUser } from "@/lib/session";

export type Task = { id: string; text: string; done: boolean };
export type Note = { id: string; text: string; at: number };
export type Sub = { id: string; name: string; amount: number; cycle: Cycle; start: string };
export type HubData = {
  modules: ModuleId[];
  hidden: ModuleId[];
  tasks: Task[];
  notes: Note[];
  subs: Sub[];
  focusMinutes: number;
  city: string;
};

const KEY = "nexora.hub.v1";
const SYNC_KEY = "nexora.hub.syncedAt";
const empty: HubData = {
  modules: allModules.map((m) => m.id),
  hidden: [],
  tasks: [],
  notes: [],
  subs: [],
  focusMinutes: 0,
  city: "Nairobi",
};

export type CloudStatus = "off" | "syncing" | "synced" | "error";

/** Coerce unknown cloud JSON into a valid HubData; bad shapes fall back to defaults. */
export function sanitizeHub(value: unknown): HubData | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Partial<HubData>;
  const arr = (x: unknown): unknown[] => (Array.isArray(x) ? x : []);
  const known = (m: unknown): m is ModuleId =>
    typeof m === "string" && allModules.some((a) => a.id === m);
  const tasks = arr(v.tasks).flatMap((t) => {
    const o = t as Partial<Task> | null;
    return o && typeof o.text === "string"
      ? [{ id: String(o.id ?? Math.random().toString(36).slice(2, 10)), text: o.text, done: !!o.done }]
      : [];
  });
  const notes = arr(v.notes).flatMap((n) => {
    const o = n as Partial<Note> | null;
    return o && typeof o.text === "string"
      ? [{ id: String(o.id ?? Math.random().toString(36).slice(2, 10)), text: o.text, at: Number(o.at) || 0 }]
      : [];
  });
  const subs = arr(v.subs).flatMap((s) => {
    const o = s as Partial<Sub> | null;
    if (!o || typeof o.name !== "string" || typeof o.amount !== "number") return [];
    const cycle: Cycle = o.cycle === "weekly" || o.cycle === "yearly" ? o.cycle : "monthly";
    return [
      {
        id: String(o.id ?? Math.random().toString(36).slice(2, 10)),
        name: o.name,
        amount: o.amount,
        cycle,
        start: typeof o.start === "string" ? o.start : "2026-01-01",
      },
    ];
  });
  return {
    modules: arr(v.modules).filter(known),
    hidden: arr(v.hidden).filter(known),
    tasks,
    notes,
    subs,
    focusMinutes: typeof v.focusMinutes === "number" ? v.focusMinutes : 0,
    city: typeof v.city === "string" ? v.city : "Nairobi",
  };
}

/** Last-write-wins: cloud wins when its updated_at is newer than this device's last sync. */
export function resolveHub(
  local: HubData,
  cloud: { data: unknown; updated_at: string } | null,
  lastSync: number,
): { data: HubData; winner: "local" | "cloud" } {
  const clean = sanitizeHub(cloud?.data ?? null);
  if (!clean) return { data: local, winner: "local" };
  const cloudTime = Date.parse(cloud?.updated_at ?? "") || 0;
  return cloudTime > lastSync ? { data: clean, winner: "cloud" } : { data: local, winner: "local" };
}

/**
 * Device cache (localStorage) plus per-account cloud sync in profiles/hub_state.
 * Ghost State keeps edits in memory until Commit.
 */
export function useHub() {
  const [saved, setSaved] = useState<HubData>(empty);
  const [ghost, setGhost] = useState<HubData | null>(null);
  const [ready, setReady] = useState(false);
  const [cloud, setCloud] = useState<CloudStatus>("off");
  const pulledFor = useRef<string | null>(null);
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const signedIn = !!currentUser();

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setSaved({ ...empty, ...JSON.parse(raw) });
    } catch {
      /* corrupt cache ignored */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready)
      try {
        localStorage.setItem(KEY, JSON.stringify(saved));
      } catch {
        /* quota */
      }
  }, [saved, ready]);

  // Pull once per sign-in; cloud wins only when it is newer than the last push from this device.
  useEffect(() => {
    const user = currentUser();
    if (!ready || !user || pulledFor.current === user.id) return;
    pulledFor.current = user.id;
    let cancelled = false;
    setCloud("syncing");
    void supabase
      .from("hub_state")
      .select("data, updated_at")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setCloud("error");
          return;
        }
        const lastSync = Number(localStorage.getItem(SYNC_KEY) ?? 0);
        const row = data as { data: unknown; updated_at: string } | null;
        setSaved((local) => resolveHub(local, row, lastSync).data);
        setCloud("synced");
      });
    return () => {
      cancelled = true;
    };
  }, [ready, signedIn]);

  // Debounced push whenever signed in and data changes.
  useEffect(() => {
    if (!ready || !signedIn) {
      setCloud("off");
      return;
    }
    if (pushTimer.current) clearTimeout(pushTimer.current);
    pushTimer.current = setTimeout(async () => {
      const user = currentUser();
      if (!user) return;
      setCloud("syncing");
      const { error } = await supabase.from("hub_state").upsert({ user_id: user.id, data: saved });
      if (error) {
        setCloud("error");
        return;
      }
      await supabase.from("profiles").update({ modules: saved.modules }).eq("id", user.id);
      localStorage.setItem(SYNC_KEY, String(Date.now()));
      setCloud("synced");
    }, 900);
    return () => {
      if (pushTimer.current) clearTimeout(pushTimer.current);
    };
  }, [saved, ready, signedIn]);

  const data = ghost ?? saved;
  const update = useCallback(
    (fn: (d: HubData) => HubData) => {
      if (ghost) setGhost((g) => (g ? fn(g) : g));
      else setSaved(fn);
    },
    [ghost],
  );
  return {
    data,
    update,
    ready,
    ghostOn: !!ghost,
    cloud,
    enterGhost: () => setGhost(structuredClone(saved)),
    commitGhost: () => {
      if (ghost) setSaved(ghost);
      setGhost(null);
    },
    discardGhost: () => setGhost(null),
  };
}
export const newId = () => Math.random().toString(36).slice(2, 10);
