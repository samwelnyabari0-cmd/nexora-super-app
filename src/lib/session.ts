import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type SessionState = { user: User | null; ready: boolean };

let cached: SessionState = { user: null, ready: false };
let started = false;
let suspensionTimer: number | null = null;
let checkingUserId: string | null = null;
const subs = new Set<() => void>();

function notify() {
  subs.forEach((fn) => fn());
}

/**
 * Re-check the signed-in user's suspension status.
 * Network/RPC errors fail open so a temporary outage does not sign out
 * legitimate users; server-side authorization must still protect data.
 */
async function checkSuspension() {
  const user = cached.user;
  if (!user || checkingUserId) return;

  checkingUserId = user.id;
  try {
    const { data, error } = await supabase.rpc("is_my_account_suspended");
    if (!error && data === true && cached.user?.id === user.id) {
      await supabase.auth.signOut({ scope: "local" });
    }
  } catch {
    // A failed status check must not be treated as a confirmed suspension.
  } finally {
    checkingUserId = null;
  }
}

function startSuspensionMonitor() {
  if (suspensionTimer !== null || typeof window === "undefined") return;

  suspensionTimer = window.setInterval(() => {
    void checkSuspension();
  }, 60_000);

  window.addEventListener("focus", checkSuspension);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void checkSuspension();
  });
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
      if (event === "SIGNED_IN" && nextSession?.user) {
        window.setTimeout(() => void checkSuspension(), 0);
      }
    });

    startSuspensionMonitor();
    if (cached.user) void checkSuspension();
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
