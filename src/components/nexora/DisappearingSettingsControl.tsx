import { useEffect, useRef, useState } from "react";
import { Clock3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type DisappearingSettingsControlProps = {
  chatKind: "direct" | "group";
  chatId: string;
};

const OPTIONS = [
  { value: 0, label: "Off" },
  { value: 86_400, label: "24 hours" },
  { value: 604_800, label: "7 days" },
  { value: 2_592_000, label: "30 days" },
];

export function DisappearingSettingsControl({ chatKind, chatId }: DisappearingSettingsControlProps) {
  const [retentionSeconds, setRetentionSeconds] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const requestRef = useRef(0);

  useEffect(() => {
    if (!chatId) return;
    let cancelled = false;
    requestRef.current += 1;
    setLoading(true);
    setSaving(false);
    setError("");
    void (supabase as any).rpc("get_chat_disappearing_setting", {
      p_chat_kind: chatKind,
      p_chat_id: chatId,
    }).then(({ data, error: loadError }: { data: any; error: any }) => {
      if (cancelled) return;
      if (loadError) {
        setError(loadError?.message || "Expiry setting could not be loaded.");
      } else {
        const row = Array.isArray(data) ? data[0] : data;
        setRetentionSeconds(Number(row?.retention_seconds ?? 0));
      }
      setLoading(false);
    }).catch(() => {
      if (!cancelled) {
        setError("Expiry setting could not be loaded.");
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [chatId, chatKind]);

  async function changeRetention(value: number) {
    const requestId = requestRef.current;
    setSaving(true);
    setError("");
    try {
      const { error: saveError } = await (supabase as any).rpc("set_chat_disappearing_setting", {
        p_chat_kind: chatKind,
        p_chat_id: chatId,
        p_retention_seconds: value,
      });
      if (requestId !== requestRef.current) return;
      if (saveError) {
        setError(saveError.message || "Expiry setting could not be saved.");
      } else {
        setRetentionSeconds(value);
      }
    } catch {
      if (requestId === requestRef.current) {
        setError("Expiry setting could not be saved. Check your connection and try again.");
      }
    } finally {
      if (requestId === requestRef.current) setSaving(false);
    }
  }

  const selected = OPTIONS.find((option) => option.value === retentionSeconds)?.label ?? "Off";

  return (
    <details className="w-fit max-w-full shrink-0 self-start rounded-lg border px-2 py-0.5">
      <summary className="flex cursor-pointer list-none items-center gap-2 py-0.5 text-xs font-medium text-muted-foreground">
        <Clock3 className="h-3.5 w-3.5" aria-hidden />
        <span>Expiry · {loading ? "Loading…" : saving ? "Saving…" : selected}</span>
      </summary>
      <div className="flex flex-wrap items-center gap-2 pb-2">
        <label htmlFor={`message-expiry-${chatKind}-${chatId}`} className="text-xs font-medium">New message expiry</label>
        <select
          id={`message-expiry-${chatKind}-${chatId}`}
          aria-label="New message expiry"
          className="rounded-lg border bg-background px-2 py-1 text-xs"
          value={retentionSeconds}
          disabled={loading || saving}
          onChange={(event) => void changeRetention(Number(event.target.value))}
        >
          {OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <p className="basis-full text-[11px] text-muted-foreground">
          Applies to new messages only. Expired messages are hidden by server access rules; automatic physical deletion is not scheduled.
        </p>
        {error && <p role="alert" className="basis-full text-xs text-destructive">{error}</p>}
      </div>
    </details>
  );
}
