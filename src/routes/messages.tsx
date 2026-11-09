import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  Clock,
  Check,
  LoaderCircle,
  VolumeX,
  Reply,
  Pencil,
  Trash2,
  Plus,
  Search,
  X,
  Package,
} from "lucide-react";
import { creators, creatorById, type Message } from "@/features/core/data";
import { useApp } from "@/features/core/store";
import { useWorkspace } from "@/features/core/workspace";
import { Avatar, PageHeader } from "@/components/nexora/ui";
import { ChatComposer, AttachmentPreview } from "@/components/nexora/ChatComposer";
import { InternationalOrderChat } from "@/components/nexora/InternationalOrderChat";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
export const Route = createFileRoute("/messages")({
  head: () => ({
    meta: [
      { title: "Messages — NEXORA" },
      {
        name: "description",
        content:
          "Account chat with video, file and voice attachments, replies and conversation search.",
      },
      { property: "og:title", content: "Messages — NEXORA" },
      {
        property: "og:description",
        content:
          "Account chat with video, file and voice attachments, replies and conversation search.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Messages,
});
function Messages() {
  const { conversations, markConversationRead, startConversation, editMessage, deleteMessage } =
    useApp();
  const { muted, toggleMute } = useWorkspace();
  const [active, setActive] = useState(conversations[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [newChat, setNewChat] = useState(false);
  const [reply, setReply] = useState<Message>();
  const [editing, setEditing] = useState<Message>();
  const [edit, setEdit] = useState("");
  const [showOrderTools, setShowOrderTools] = useState(false);
  const log = useRef<HTMLDivElement>(null);
  const conv = conversations.find((c) => c.id === active);
  useEffect(() => {
    markConversationRead(active);
    setReply(undefined);
    setQuery("");
  }, [active]);
  useEffect(() => {
    const node = log.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [active, conv?.messages.length]);
  if (!conv) return <PageHeader title="No conversations" />;
  const who = creatorById(conv.creatorId);
  const shown = conv.messages.filter((m) =>
    `${m.text} ${m.attachments?.map((a) => a.name).join(" ") ?? ""}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <div>
      <PageHeader
        title="Messages"
        action={
          <div className="flex items-center gap-2">
            
            <Button
              size="icon"
              variant="outline"
              aria-label="New conversation"
              title="New conversation"
              onClick={() => setNewChat(true)}
            >
              <Plus />
            </Button>
          </div>
        }
      />
      <div className="grid min-w-0 gap-4 md:grid-cols-[240px_minmax(0,1fr)]">
        <ul className="flex gap-2 overflow-x-auto md:flex-col">
          {conversations.map((c) => {
            const p = creatorById(c.creatorId);
            return (
              <li key={c.id}>
                <Button
                  variant="ghost"
                  onClick={() => setActive(c.id)}
                  aria-label={`Chat with ${p.name}`}
                  aria-pressed={c.id === active}
                  className={cn(
                    "h-auto w-full justify-start rounded-2xl p-3",
                    c.id === active && "border bg-card",
                  )}
                >
                  <Avatar name={p.name} hue={p.hue} size={38} />
                  <span className="hidden min-w-0 flex-1 text-left md:block">
                    <span className="block truncate font-semibold">{p.name}</span>
                    <span className="block max-w-36 truncate text-xs text-muted-foreground">
                      {c.messages.at(-1)?.text || "Attachment"}
                    </span>
                  </span>
                  {c.unread > 0 && (
                    <span className="rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
                      {c.unread}
                    </span>
                  )}
                </Button>
              </li>
            );
          })}
        </ul>
        <section className="flex h-[75dvh] min-h-[480px] min-w-0 flex-col rounded-3xl border bg-card">
          <div className="flex items-center gap-3 border-b p-3">
            <Avatar name={who.name} hue={who.hue} size={32} />
            <p className="min-w-0 flex-1 truncate font-semibold">{who.name}</p>
            <Button
              size="icon"
              variant="ghost"
              aria-label="Open order and business tools"
              title="Order and business tools"
              aria-pressed={showOrderTools}
              onClick={() => setShowOrderTools(true)}
            >
              <Package />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              aria-label={muted.includes(who.id) ? "Unmute conversation" : "Mute conversation"}
              title="Mute conversation"
              aria-pressed={muted.includes(who.id)}
              onClick={() => toggleMute(who.id)}
            >
              <VolumeX />
            </Button>
          </div>
          <label className="flex items-center gap-2 border-b px-3 py-2 text-sm">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              aria-label="Search conversation"
              className="min-w-0 flex-1 bg-transparent"
              placeholder="Search conversation"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <Button
                size="icon"
                variant="ghost"
                aria-label="Clear conversation search"
                onClick={() => setQuery("")}
              >
                <X />
              </Button>
            )}
          </label>
          <Dialog open={showOrderTools} onOpenChange={setShowOrderTools}>
            <DialogContent className="max-h-[90dvh] overflow-y-auto p-0">
              <DialogTitle className="sr-only">Order and business tools</DialogTitle>
              <InternationalOrderChat />
            </DialogContent>
          </Dialog>
          <div
            ref={log}
            className="flex-1 space-y-3 overflow-y-auto p-4"
            aria-live="polite"
            role="log"
          >
            {!shown.length && (
              <p className="py-10 text-center text-sm text-muted-foreground">
                {query ? "No matching messages." : "No messages yet."}
              </p>
            )}
            {shown.map((m) => (
              <div
                key={m.id}
                className={cn(
                  "w-fit max-w-[90%] space-y-2 break-words rounded-2xl px-3 py-2 text-sm",
                  m.from === "me" ? "ml-auto bg-brand text-primary-foreground" : "bg-muted",
                )}
              >
                {m.replyTo && (
                  <p className="border-l-2 border-current pl-2 text-xs opacity-80">
                    Reply:{" "}
                    {conv.messages.find((x) => x.id === m.replyTo)?.text ||
                      "Attachment or removed message"}
                  </p>
                )}
                {m.text && <p>{m.text}</p>}
                {m.attachments?.map((a) => (
                  <AttachmentPreview key={a.id} attachment={a} />
                ))}
                <span className="flex flex-wrap items-center gap-1 text-[10px] opacity-80">
                  {m.at}
                  {m.edited && " · Edited"}
                  {m.status === "queued" ? (
                    <>
                      <Clock className="h-3 w-3" />
                      Waiting for connection
                    </>
                  ) : m.status === "sending" ? (
                    <>
                      <LoaderCircle className="h-3 w-3 animate-spin" />
                      Saving…
                    </>
                  ) : m.status === "failed" ? (
                    "Could not save"
                  ) : m.from === "me" ? (
                    <>
                      <Check className="h-3 w-3" />
                      Saved to account
                    </>
                  ) : null}
                </span>
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-inherit"
                    aria-label="Reply to message"
                    title="Reply"
                    onClick={() => setReply(m)}
                  >
                    <Reply className="h-3.5 w-3.5" />
                  </Button>
                  {m.from === "me" && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-inherit"
                        aria-label="Edit message"
                        title="Edit"
                        onClick={() => {
                          setEditing(m);
                          setEdit(m.text);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-inherit"
                        aria-label="Delete message"
                        title="Delete message"
                        onClick={() => deleteMessage(active, m.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
          <ChatComposer
            key={active}
            conversationId={active}
            reply={reply}
            onReplySent={() => setReply(undefined)}
          />
        </section>
      </div>
      <Dialog open={newChat} onOpenChange={setNewChat}>
        <DialogContent>
          <DialogTitle>New conversation</DialogTitle>
          {creators.map((c) => (
            <Button
              key={c.id}
              variant="ghost"
              className="justify-start"
              onClick={() => {
                setActive(startConversation(c.id));
                setNewChat(false);
              }}
            >
              <Avatar name={c.name} hue={c.hue} size={30} />
              {c.name}
            </Button>
          ))}
          <p className="text-xs text-muted-foreground">
            No invitation or message is delivered to a real person.
          </p>
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(editing)}
        onOpenChange={(v) => {
          if (!v) setEditing(undefined);
        }}
      >
        <DialogContent>
          <DialogTitle>Edit message</DialogTitle>
          <textarea
            aria-label="Edit message text"
            value={edit}
            onChange={(e) => setEdit(e.target.value)}
            className="w-full rounded-lg border bg-background p-3"
          />
          <Button
            disabled={!edit.trim()}
            onClick={() => {
              if (!editing) return;
              editMessage(active, editing.id, edit);
              setEditing(undefined);
            }}
          >
            Save changes
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
