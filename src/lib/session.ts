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
  const { data } = await supabase.auth.getSession();
  cached = { user: data.session?.user ?? null, ready: true };
  notify();
  supabase.auth.onAuthStateChange((event, session) => {
    if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
    cached = { user: session?.user ?? null, ready: true };
    notify();
  });
}

export function useSession(): SessionState {
  const [, force] = useState(0);
  useEffect(() => {
    void init();
    const fn = () => force((n) => n + 1);
    subs.add(fn);
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
