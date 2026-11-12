
import { useEffect, useState } from "react";
import { History, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type HistoryItem = {
  id: string;
  prompt: string;
  mode: "summarize" | "caption";
  result_preview?: string | null;
  created_at: string;
};

type Draft = {
  prompt: string;
  mode: "summarize" | "caption";
  resultPreview?: string;
  savedAt: number;
};

type Props = {
  userId?: string;
  mode: "summarize" | "caption";
  draft?: Draft | null;
  onReuse: (prompt: string) => void;
};

const LOCAL_KEY = "nexora_ai_studio_searches";

function readLocal(): HistoryItem[] {
  try {
    const value = localStorage.getItem(LOCAL_KEY);
    return value ? JSON.parse(value) as HistoryItem[] : [];
  } catch {
    return [];
  }
}

function writeLocal(items: HistoryItem[]) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(items.slice(0, 20)));
  } catch {
    toast.error("Could not save prompt on this device.");
  }
}

export function AIStudioHistory({
  userId,
  mode,
  draft,
  onReuse,
}: Props) {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (userId) {
        const { data, error } = await supabase
          .from("ai_studio_history")
          .select("id, prompt, mode, result_preview, created_at")
          .eq("user_id", userId)
          .eq("mode", mode)
          .order("created_at", { ascending: false })
          .limit(20);

        if (!cancelled && !error && data) {
          setItems(data as HistoryItem[]);
          setLoaded(true);
          return;
        }
      }

      if (!cancelled) {
        setItems(readLocal().filter((item) => item.mode === mode));
        setLoaded(true);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [userId, mode]);

  useEffect(() => {
    if (!loaded || !draft || draft.mode !== mode || !draft.prompt.trim()) {
      return;
    }

    let cancelled = false;

    async function save() {
      const cleanPrompt = draft!.prompt.trim();

      const duplicate = items.some(
        (item) => item.prompt.toLowerCase() === cleanPrompt.toLowerCase()
      );

      if (duplicate) return;

      const localEntry: HistoryItem = {
        id: crypto.randomUUID(),
        prompt: cleanPrompt,
        mode,
        result_preview: draft!.resultPreview?.slice(0, 500) ?? null,
        created_at: new Date().toISOString(),
      };

      const localItems = [
        localEntry,
        ...readLocal().filter(
          (item) =>
            !(item.mode === mode &&
              item.prompt.toLowerCase() === cleanPrompt.toLowerCase())
        ),
      ].slice(0, 20);

      writeLocal(localItems);

      if (userId) {
        const { data, error } = await supabase
          .from("ai_studio_history")
          .insert({
            user_id: userId,
            prompt: cleanPrompt,
            mode,
            result_preview: draft!.resultPreview?.slice(0, 500) ?? null,
          })
          .select("id, prompt, mode, result_preview, created_at")
          .single();

        if (!cancelled && !error && data) {
          setItems((current) => [
            data as HistoryItem,
            ...current.filter(
              (item) =>
                item.prompt.toLowerCase() !== cleanPrompt.toLowerCase()
            ),
          ].slice(0, 20));
          return;
        }
      }

      if (!cancelled) {
        setItems((current) => [
          localEntry,
          ...current.filter(
            (item) =>
              item.prompt.toLowerCase() !== cleanPrompt.toLowerCase()
          ),
        ].slice(0, 20));
      }
    }

    void save();
    return () => {
      cancelled = true;
    };
  }, [draft?.savedAt, loaded, userId, mode]);

  async function deleteItem(item: HistoryItem) {
    setItems((current) => current.filter((entry) => entry.id !== item.id));

    const localItems = readLocal().filter(
      (entry) =>
        !(entry.mode === item.mode &&
          entry.prompt === item.prompt)
    );
    writeLocal(localItems);

    if (userId) {
      const { error } = await supabase
        .from("ai_studio_history")
        .delete()
        .eq("id", item.id)
        .eq("user_id", userId);

      if (error) {
        toast.error("Could not delete cloud history.");
      }
    }
  }

  async function clearHistory() {
    setItems([]);
    writeLocal(readLocal().filter((item) => item.mode !== mode));

    if (userId) {
      const { error } = await supabase
        .from("ai_studio_history")
        .delete()
        .eq("user_id", userId)
        .eq("mode", mode);

      if (error) {
        toast.error("Could not clear cloud history.");
      }
    }
  }

  if (!loaded) return null;

  return (
    <section className="mt-5 space-y-3 border-t pt-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <History className="h-4 w-4 text-accent" />
          Previous prompts ({items.length})
        </h3>

        {items.length > 0 && (
          <button
            type="button"
            onClick={clearHistory}
            className="text-xs text-destructive hover:underline"
          >
            Clear all
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <p className="rounded-xl border bg-card p-3 text-xs text-muted-foreground">
          Your previous prompts will appear here after you generate something.
        </p>
      ) : (
        <div className="max-h-64 space-y-2 overflow-y-auto">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-2 rounded-xl border bg-card p-3"
            >
              <button
                type="button"
                onClick={() => onReuse(item.prompt)}
                className="min-w-0 flex-1 text-left"
                title="Reuse this prompt"
              >
                <p className="line-clamp-2 text-sm">{item.prompt}</p>
                <span className="mt-1 block text-[10px] text-muted-foreground">
                  {new Date(item.created_at).toLocaleString()}
                </span>
              </button>

              <button
                type="button"
                onClick={() => onReuse(item.prompt)}
                aria-label="Reuse prompt"
                title="Reuse prompt"
                className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <RotateCcw className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={() => void deleteItem(item)}
                aria-label="Delete prompt"
                title="Delete prompt"
                className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
    }
          
