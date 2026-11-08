import { createContext, useContext, useState, type ReactNode } from "react";
import { toast } from "sonner";
export type Draft = {
  id: string;
  caption: string;
  media?: string;
  mediaType?: string;
  tags: string[];
  audience: "public" | "private";
  filter?: string;
  format?: string;
};
export type Notice = {
  id: string;
  title: string;
  detail: string;
  read: boolean;
  kind: "activity" | "safety";
};
export type Preferences = {
  privateProfile: boolean;
  allowMessages: boolean;
  activityNotices: boolean;
  reduceMotion: boolean;
  largeText: boolean;
  highContrast: boolean;
};
function useWorkspaceState() {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [collections, setCollections] = useState<Record<string, string[]>>({ Favorites: ["p4"] });
  const [following, setFollowing] = useState(["c1", "c3", "c5"]);
  const [muted, setMuted] = useState<string[]>([]);
  const [reports, setReports] = useState<{ target: string; reason: string }[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [preferences, setPreferences] = useState<Preferences>({
    privateProfile: false,
    allowMessages: true,
    activityNotices: true,
    reduceMotion: false,
    largeText: false,
    highContrast: false,
  });
  const notify = (title: string, detail: string, kind: Notice["kind"] = "activity") => {
    if (kind === "activity" && !preferences.activityNotices) return;
    setNotices((n) =>
      [{ id: crypto.randomUUID(), title, detail, kind, read: false }, ...n].slice(0, 50),
    );
  };
  return {
    drafts,
    collections,
    following,
    muted,
    reports,
    notices,
    preferences,
    setPreferences,
    saveDraft: (d: Draft) => {
      setDrafts((ds) => [d, ...ds.filter((x) => x.id !== d.id)]);
      notify("Draft saved", d.caption || "Untitled draft");
      toast.success("Draft saved for this session");
    },
    removeDraft: (id: string) => setDrafts((ds) => ds.filter((d) => d.id !== id)),
    addCollection: (name: string) => {
      const n = name.trim();
      if (n === "All saved" || Object.hasOwn(collections, n)) {
        toast.error("Choose a different collection name");
        return;
      }
      if (n) setCollections((c) => ({ ...c, [n]: [] }));
    },
    removeCollection: (name: string) =>
      setCollections((c) => Object.fromEntries(Object.entries(c).filter(([key]) => key !== name))),
    collect: (name: string, id: string) =>
      setCollections((c) => ({
        ...c,
        [name]: c[name]?.includes(id) ? c[name].filter((x) => x !== id) : [...(c[name] ?? []), id],
      })),
    toggleFollow: (id: string) => {
      setFollowing((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]));
      notify(
        following.includes(id) ? "Creator unfollowed" : "Creator followed",
        "Your local Following feed has been updated.",
      );
    },
    toggleMute: (id: string) => {
      setMuted((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]));
    },
    report: (target: string, reason: string) => {
      setReports((r) => [...r, { target, reason }]);
      notify("Report saved locally", `${reason}. No moderation service is connected.`, "safety");
      toast("Report saved locally — not submitted to moderators");
    },
    notify,
    markRead: (id?: string) =>
      setNotices((n) => n.map((x) => (!id || x.id === id ? { ...x, read: true } : x))),
  };
}
type Workspace = ReturnType<typeof useWorkspaceState>;
const Context = createContext<Workspace | null>(null);
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const state = useWorkspaceState();
  return (
    <Context.Provider value={state}>
      <div
        className={[
          state.preferences.reduceMotion ? "reduce-motion" : "",
          state.preferences.largeText ? "large-text" : "",
          state.preferences.highContrast ? "high-contrast" : "",
        ].join(" ")}
      >
        {children}
      </div>
    </Context.Provider>
  );
}
export function useWorkspace() {
  const value = useContext(Context);
  if (!value) throw new Error("Workspace provider missing");
  return value;
}
