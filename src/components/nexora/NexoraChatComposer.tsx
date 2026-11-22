import { useEffect, useRef, type ReactNode } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";

type NexoraChatComposerProps = {
  value: string;
  onValueChange: (value: string) => void;
  placeholder: string;
  disabled?: boolean;
  canSend: boolean;
  sendLabel: string;
  leadingAction: ReactNode;
  trailingAction?: ReactNode;
};

export function NexoraChatComposer({
  value,
  onValueChange,
  placeholder,
  disabled = false,
  canSend,
  sendLabel,
  leadingAction,
  trailingAction,
}: NexoraChatComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    const lineHeight = Number.parseFloat(getComputedStyle(textarea).lineHeight) || 24;
    const maxHeight = lineHeight * 6 + 24;
    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [value]);

  return (
    <div className="flex min-w-0 items-end gap-2">
      {leadingAction}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            event.currentTarget.form?.requestSubmit();
          }
        }}
        placeholder={placeholder}
        maxLength={2000}
        rows={1}
        aria-label={placeholder}
        className="max-h-[9rem] min-h-11 min-w-0 flex-1 resize-none overflow-y-hidden rounded-3xl border bg-background px-4 py-3 text-base leading-6 outline-none focus:ring-2 focus:ring-primary"
      />
      {trailingAction}
      <Button type="submit" size="icon" className="h-11 w-11 shrink-0 rounded-full" aria-label={sendLabel} disabled={!canSend || disabled}>
        <Send className="h-4 w-4" />
      </Button>
    </div>
  );
}
