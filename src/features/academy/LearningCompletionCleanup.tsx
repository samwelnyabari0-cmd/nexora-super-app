import { useCallback, useEffect, useMemo, useState } from "react";
import { Archive, CheckCircle2, History, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type CompletionItem = {
  id: string;
  item_type: "course" | "lesson";
  course_id: string | null;
  lesson_id: string | null;
  item_title: string;
  course_title: string;
  completed_at: string;
};

type HiddenItem = {
  id: string;
  item_type: "course" | "lesson";
  course_id: string | null;
  lesson_id: string | null;
};

function itemKey(item: Pick<CompletionItem, "item_type" | "course_id" | "lesson_id">) {
  return item.item_type + ":" + (item.item_type === "course" ? item.course_id : item.lesson_id);
}

export function LearningCompletionCleanup({
  userId,
  onChanged,
}: {
  userId: string;
  onChanged?: () => void;
}) {
  const [history, setHistory] = useState<CompletionItem[]>([]);
  const [hidden, setHidden] = useState<HiddenItem[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [historyResult, hiddenResult] = await Promise.all([
      (supabase as any)
        .from("edu_completion_history")
        .select("id,item_type,course_id,lesson_id,item_title,course_title,completed_at")
        .eq("user_id", userId)
        .order("completed_at", { ascending: false }),
      (supabase as any)
        .from("edu_learning_hidden_items")
        .select("id,item_type,course_id,lesson_id")
        .eq("user_id", userId),
    ]);
    if (historyResult.error || hiddenResult.error) {
      setError(historyResult.error?.message || hiddenResult.error?.message || "Could not load completion history.");
      setLoading(false);
      return;
    }
    setHistory((historyResult.data ?? []) as CompletionItem[]);
    setHidden((hiddenResult.data ?? []) as HiddenItem[]);
    setSelected([]);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const hiddenKeys = useMemo(() => new Set(hidden.map((item) => itemKey(item))), [hidden]);
  const visibleToHide = useMemo(
    () => history.filter((item) => !hiddenKeys.has(itemKey(item)) && (item.item_type === "course" ? Boolean(item.course_id) : Boolean(item.lesson_id))),
    [history, hiddenKeys],
  );
  const selectedCount = selected.length;

  async function hideSelected() {
    const items = visibleToHide.filter((item) => selected.includes(item.id));
    if (!items.length) return;
    setBusy(true);
    setError(null);
    const rows = items.map((item) => ({
      user_id: userId,
      item_type: item.item_type,
      course_id: item.item_type === "course" ? item.course_id : null,
      lesson_id: item.item_type === "lesson" ? item.lesson_id : null,
    }));
    const { error: saveError } = await (supabase as any)
      .from("edu_learning_hidden_items")
      .upsert(rows, { onConflict: "user_id,item_type,course_id,lesson_id" });
    if (saveError) {
      setError(saveError.message || "Could not hide the selected completed items.");
    } else {
      await load();
      onChanged?.();
    }
    setBusy(false);
  }

  async function restore(item: HiddenItem) {
    setBusy(true);
    setError(null);
    const { error: restoreError } = await (supabase as any)
      .from("edu_learning_hidden_items")
      .delete()
      .eq("id", item.id)
      .eq("user_id", userId);
    if (restoreError) {
      setError(restoreError.message || "Could not restore this item.");
    } else {
      await load();
      onChanged?.();
    }
    setBusy(false);
  }

  return (
    <section className="space-y-4" aria-label="Completed learning cleanup">
      <div className="rounded-2xl border bg-background p-4">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-500/10 text-emerald-400">
            <History className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold">Completion history</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Your achievements stay recorded here. Hiding an item only removes it from your active learning list.
            </p>
          </div>
        </div>
      </div>

      {error && <div role="alert" className="rounded-xl border border-destructive/40 p-3 text-sm text-destructive">{error}</div>}

      {loading ? (
        <div className="rounded-2xl border p-6 text-center text-sm text-muted-foreground">Loading your completion history…</div>
      ) : history.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-7 text-center">
          <CheckCircle2 className="mx-auto h-7 w-7 text-muted-foreground" />
          <p className="mt-3 font-semibold">No completed items yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Completed lessons and courses will appear here automatically.</p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold">Completed courses and lessons ({history.length})</p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" disabled={!visibleToHide.length || busy}
                onClick={() => setSelected(selected.length === visibleToHide.length ? [] : visibleToHide.map((item) => item.id))}>
                {selected.length === visibleToHide.length && visibleToHide.length ? "Clear selection" : "Select all"}
              </Button>
              <Button type="button" size="sm" disabled={!selectedCount || busy} onClick={() => void hideSelected()}>
                <Archive className="mr-1 h-4 w-4" /> Hide selected ({selectedCount})
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            {history.map((item) => {
              const hiddenItem = hidden.find((entry) => itemKey(entry) === itemKey(item));
              return (
                <article key={item.id} className="flex items-start gap-3 rounded-xl border bg-background p-3">
                  {!hiddenItem && (
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 accent-primary"
                      aria-label={"Select " + item.item_title}
                      checked={selected.includes(item.id)}
                      onChange={(event) => setSelected((current) => event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id))}
                    />
                  )}
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-emerald-500/10 text-emerald-400">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{item.item_title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.item_type === "lesson" ? "Lesson · " + item.course_title : "Course"}
                      {" · Completed " + new Date(item.completed_at).toLocaleDateString()}
                    </p>
                    {hiddenItem && <p className="mt-1 text-xs text-muted-foreground">Hidden from active learning</p>}
                  </div>
                  {hiddenItem ? (
                    <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => void restore(hiddenItem)}>
                      <RotateCcw className="mr-1 h-4 w-4" /> Restore
                    </Button>
                  ) : (
                    <span className="shrink-0 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-400">Completed</span>
                  )}
                </article>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
