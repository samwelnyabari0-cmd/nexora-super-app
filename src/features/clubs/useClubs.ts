import { useEffect, useState } from "react";
import { emptyClubs, sanitizeClubs, type ClubsState } from "./logic";

const KEY = "nexora.clubs.v1";

/** Clubs & guilds state saved in this browser only (localStorage). */
export function useClubs() {
  const [state, setState] = useState<ClubsState>(emptyClubs);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setState(sanitizeClubs(JSON.parse(raw)));
    } catch {
      /* corrupt cache ignored */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready)
      try {
        localStorage.setItem(KEY, JSON.stringify(state));
      } catch {
        /* quota */
      }
  }, [state, ready]);

  return { state, update: setState, ready };
}

export const clubMsgId = () => Math.random().toString(36).slice(2, 10);
