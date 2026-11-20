import { useState } from "react";

export const MESSAGE_REACTION_EMOJIS = ["❤️", "😂", "👍", "😮", "😢", "🙏"] as const;
export type MessageReactionEmoji = (typeof MESSAGE_REACTION_EMOJIS)[number];

export type MessageReaction = {
  message_id: string;
  user_id: string;
  emoji: MessageReactionEmoji;
};

type MessageReactionsProps = {
  messageId: string;
  userId: string;
  reactions: MessageReaction[];
  onToggle: (messageId: string, emoji: MessageReactionEmoji) => void;
};

export function MessageReactions({
  messageId,
  userId,
  reactions,
  onToggle,
}: MessageReactionsProps) {
  const [expanded, setExpanded] = useState(false);
  const messageReactions = reactions.filter((reaction) => reaction.message_id === messageId);
  const counts = MESSAGE_REACTION_EMOJIS
    .map((emoji) => ({
      emoji,
      count: messageReactions.filter((reaction) => reaction.emoji === emoji).length,
      selected: messageReactions.some((reaction) =>
        reaction.user_id === userId && reaction.emoji === emoji
      ),
    }))
    .filter((item) => item.count > 0);

  return (
    <div className="mt-1 flex flex-wrap items-center gap-1">
      {counts.map((item) => (
        <button
          key={item.emoji}
          type="button"
          onClick={() => onToggle(messageId, item.emoji)}
          aria-label={`${item.emoji} reaction, ${item.count} total`}
          aria-pressed={item.selected}
          className={`rounded-full border px-2 py-0.5 text-xs ${item.selected ? "border-primary bg-primary/10" : "border-border bg-background/70"}`}
        >
          {item.emoji} {item.count}
        </button>
      ))}
      <div className="relative">
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-label="Add a reaction"
          aria-expanded={expanded}
          className="rounded-full border border-border bg-background/70 px-2 py-0.5 text-xs text-muted-foreground"
        >
          +
        </button>
        {expanded && (
          <div className="absolute bottom-full left-0 z-20 mb-1 flex gap-1 rounded-full border bg-background p-1 shadow-lg">
            {MESSAGE_REACTION_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  onToggle(messageId, emoji);
                  setExpanded(false);
                }}
                aria-label={`React with ${emoji}`}
                className="rounded-full p-1 text-base hover:bg-muted"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
