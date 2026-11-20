import { useEffect, useState } from "react";
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

  useEffect(() => {
    if (!chatId) return;
    let cancelled = false;
    setLoading(true);
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
    setSaving(true);
    setError("");
    const { error: saveError } = await (supabase as any).rpc("set_chat_disappearing_setting", {
      p_chat_kind: chatKind,
      p_chat_id: chatId,
      p_retention_seconds: value,
    });
    if (saveError) {
      setError(saveError.message || "Expiry setting could not be saved.");
    } else {
      setRetentionSeconds(value);
    }
    setSaving(false);
  }

  const selected = OPTIONS.find((option) => option.value === retentionSeconds)?.label ?? "Off";

  return (
    <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
      <Clock3 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
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
      <span className="text-[11px] text-muted-foreground">{loading ? "Loading…" : saving ? "Saving…" : selected}</span>
      <p className="basis-full text-[11px] text-muted-foreground">
        Applies to new messages only. Expired messages are hidden by server access rules; automatic physical deletion is not scheduled.
      </p>
      {error && <p role="alert" className="basis-full text-xs text-destructive">{error}</p>}
    </div>
  );
}
