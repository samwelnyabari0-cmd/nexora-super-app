import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type SessionState = { user: User | null; ready: boolean };

let cached: SessionState = { user: null, ready: false };
let started = false;
const subs = new Set<() => void>();

function notify() {
  subs.forEach((fn) => fn());
}

/** One subscription for the whole app; identity changes only. */
async function init() {
  if (started) return;
  started = true;
  cached = { user: null, ready: true };
  notify();
  try {
    const result = await Promise.race([
      supabase.auth.getSession(),
      new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 1500)),
    ]);
    const session = result && "data" in result ? result.data.session : null;
    cached = { user: session?.user ?? null, ready: true };
    notify();
    supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      cached = { user: nextSession?.user ?? null, ready: true };
      notify();
    });
  } catch {
    cached = { user: null, ready: true };
    notify();
  }
}

export function useSession(): SessionState {
  const [, force] = useState(0);
  useEffect(() => {
    const fn = () => force((n) => n + 1);
    subs.add(fn);
    void init();
    return () => {
      subs.delete(fn);
    };
  }, []);
  return cached;
}

/** Non-hook reader for event handlers / stores (client-side only). */
export function currentUser(): User | null {
  void init();
  return cached.user;
}
