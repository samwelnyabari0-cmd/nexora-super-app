import { useEffect, useState } from "react";

/** State saved in this browser only (localStorage). */
export function useLocal<T>(key: string, initial: T) {
  const [v, setV] = useState<T>(initial);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) setV(JSON.parse(raw));
    } catch {
      /* ignore */
    }
    setReady(true);
  }, [key]);
  useEffect(() => {
    if (ready)
      try {
        localStorage.setItem(key, JSON.stringify(v));
      } catch {
        /* quota */
      }
  }, [key, v, ready]);
  return [v, setV] as const;
}
