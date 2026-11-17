import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { MessageCircle, Send, LifeBuoy, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/nexora/ui";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";

type Ticket = {
  id: string;
  subject: string;
  category: string;
  description: string;
  status: string;
  priority: string;
  created_at: string;
  updated_at: string;
};
type TicketMessage = {
  id: string;
  ticket_id: string;
  sender_id: string;
  sender_role: "user" | "admin";
  message: string;
  created_at: string;
};

export const Route = createFileRoute("/help")({
  head: () => ({
    meta: [
      { title: "Help & support — NEXORA" },
      { name: "description", content: "Get help from the NEXORA support team and track your support requests." },
      { property: "og:title", content: "Help & support — NEXORA" },
      { property: "og:description", content: "Get help from the NEXORA support team and track your support requests." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Help,
});

const answers = [
  ["Why won’t my microphone or camera work?", "Open NEXORA on HTTPS in a supported browser. Allow microphone or camera access in browser site settings. If another app is using the device, close it and retry. You can attach files instead. Some embedded browsers restrict recording; open the app directly in Safari or Chrome."],
  ["Can I send videos and files?", "Use the video or paperclip icon in Messages to choose files from your phone or computer. Preview and remove attachments before sending. Files up to 100 MB are supported for this local demo. Unsupported media formats show a preview error. No file is uploaded to a recipient."],
  ["Are messages delivered?", "Messages and support requests require an active account and a network connection. Support requests are visible only to you and the Nexora support administrators."],
  ["Where are drafts and saved collections stored?", "Your account settings and saved content are stored according to the services connected to your Nexora account."],
  ["What is required before a production launch?", "NEXORA support requests are private to the account that submitted them. Never include passwords, one-time codes, or full payment-card details in a support request."],
];

const categories = [
  ["technical", "Technical issue"],
  ["account", "Account"],
  ["payments", "Payments"],
  ["safety", "Safety"],
  ["other", "Other"],
];

function statusLabel(status: string) {
  return status.replaceAll("_", " ").replace(/\\b\\w/g, (c) => c.toUpperCase());
}

function Help() {
  const { user } = useSession();
  const [q, setQ] = useState("");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reply, setReply] = useState("");
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("technical");
  const [description, setDescription] = useState("");
  const results = answers.filter((a) => a.join(" ").toLowerCase().includes(q.toLowerCase()));
  const selectedTicket = tickets.find((ticket) => ticket.id === selectedId) ?? null;

  async function loadTickets() {
    if (!user) return;
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("support_tickets")
      .select("id, subject, category, description, status, priority, created_at, updated_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) {
      toast.error("Could not load your support requests.");
      return;
    }
    const rows = (data ?? []) as Ticket[];
    setTickets(rows);
    setSelectedId((current) => current && rows.some((ticket) => ticket.id === current) ? current : rows[0]?.id ?? "");
  }

  useEffect(() => {
    void loadTickets();
  }, [user?.id]);

  useEffect(() => {
    let active = true;
    async function loadMessages() {
      if (!user || !selectedId) {
        setMessages([]);
        return;
      }
      setMessagesLoading(true);
      const { data, error } = await (supabase as any)
        .from("support_ticket_messages")
        .select("id, ticket_id, sender_id, sender_role, message, created_at")
        .eq("ticket_id", selectedId)
        .order("created_at", { ascending: true });
      if (!active) return;
      setMessagesLoading(false);
      if (error) {
        toast.error("Could not load this conversation.");
        return;
      }
      setMessages((data ?? []) as TicketMessage[]);
    }
    void loadMessages();
    return () => { active = false; };
  }, [user?.id, selectedId]);

  async function submitTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    if (subject.trim().length < 3 || description.trim().length < 10) {
      toast.error("Add a subject and describe the issue in at least 10 characters.");
      return;
    }
    setSubmitting(true);
    const { data, error } = await (supabase as any)
      .from("support_tickets")
      .insert({
        user_id: user.id,
        subject: subject.trim(),
        category,
        description: description.trim(),
      })
      .select("id")
      .single();
    setSubmitting(false);
    if (error || !data?.id) {
      toast.error("Your support request could not be submitted. Please try again.");
      return;
    }
    setSubject("");
    setDescription("");
    toast.success("Support request submitted.");
    await loadTickets();
    setSelectedId(data.id as string);
  }

  async function sendReply(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !selectedTicket || !reply.trim()) return;
    if (["resolved", "closed"].includes(selectedTicket.status)) {
      toast.error("This ticket is closed. Submit a new request if you still need help.");
      return;
    }
    setSubmitting(true);
    const { error } = await (supabase as any)
      .from("support_ticket_messages")
      .insert({
        ticket_id: selectedTicket.id,
        sender_id: user.id,
        sender_role: "user",
        message: reply.trim(),
      });
    setSubmitting(false);
    if (error) {
      toast.error("Your reply could not be sent.");
      return;
    }
    setReply("");
    toast.success("Reply sent.");
    const { data } = await (supabase as any)
      .from("support_ticket_messages")
      .select("id, ticket_id, sender_id, sender_role, message, created_at")
      .eq("ticket_id", selectedTicket.id)
      .order("created_at", { ascending: true });
    if (data) setMessages(data as TicketMessage[]);
    await loadTickets();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader title="Help & support" subtitle="Find answers or contact the NEXORA support team." />

      <section className="rounded-2xl border bg-card p-4 sm:p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-2 text-primary"><LifeBuoy size={21} /></div>
          <div>
            <h2 className="font-semibold">Contact support</h2>
            <p className="text-sm text-muted-foreground">Tell us what you need help with. Our team can reply in your account.</p>
          </div>
        </div>
        {user ? (
          <form onSubmit={submitTicket} className="space-y-3">
            <label className="block text-sm font-medium">
              Subject
              <input value={subject} onChange={(e) => setSubject(e.target.value)} minLength={3} maxLength={160} required placeholder="Briefly describe the issue" className="mt-1 w-full rounded-lg border bg-background px-3 py-2.5 text-sm" />
            </label>
            <label className="block text-sm font-medium">
              Category
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="mt-1 w-full rounded-lg border bg-background px-3 py-2.5 text-sm">
                {categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="block text-sm font-medium">
              Describe your issue
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} minLength={10} maxLength={5000} required rows={4} placeholder="Include what happened and what you expected to happen…" className="mt-1 w-full resize-y rounded-lg border bg-background px-3 py-2.5 text-sm" />
            </label>
            <p className="text-xs text-muted-foreground">Do not include your password, one-time codes, or full card details.</p>
            <Button type="submit" disabled={submitting} className="w-full sm:w-auto">{submitting ? "Submitting…" : "Submit support request"}</Button>
          </form>
        ) : (
          <div className="rounded-xl border border-dashed p-4">
            <p className="text-sm text-muted-foreground">Sign in to submit a support request and track replies.</p>
            <Button asChild className="mt-3"><Link to="/auth">Sign in</Link></Button>
          </div>
        )}
      </section>

      {user && (
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Your support requests</h2>
              <p className="text-sm text-muted-foreground">View updates and continue a conversation.</p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => void loadTickets()} disabled={loading}>
              <RefreshCw size={15} className={loading ? "mr-2 animate-spin" : "mr-2"} /> Refresh
            </Button>
          </div>
          {loading ? <p className="text-sm text-muted-foreground">Loading your requests…</p> : tickets.length === 0 ? (
            <div className="rounded-xl border border-dashed p-6 text-center">
              <MessageCircle className="mx-auto mb-2 text-muted-foreground" />
              <p className="font-medium">No support requests yet</p>
              <p className="mt-1 text-sm text-muted-foreground">Your submitted requests and support replies will appear here.</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
              <div className="space-y-2">
                {tickets.map((ticket) => (
                  <button key={ticket.id} type="button" onClick={() => setSelectedId(ticket.id)} className={`w-full rounded-xl border p-3 text-left transition-colors ${selectedId === ticket.id ? "border-primary bg-primary/5" : "hover:bg-muted/40"}`}>
                    <span className="block truncate text-sm font-semibold">{ticket.subject}</span>
                    <span className="mt-1 block text-xs capitalize text-muted-foreground">{ticket.category} · {statusLabel(ticket.status)}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">{new Date(ticket.created_at).toLocaleString()}</span>
                  </button>
                ))}
              </div>
              {selectedTicket && (
                <div className="min-w-0 rounded-xl border p-4">
                  <div className="border-b pb-3">
                    <h3 className="font-semibold">{selectedTicket.subject}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">{statusLabel(selectedTicket.status)} · {selectedTicket.priority} priority</p>
                  </div>
                  <div className="my-4 rounded-lg bg-muted/40 p-3">
                    <p className="mb-1 text-xs font-semibold text-muted-foreground">YOUR REQUEST</p>
                    <p className="whitespace-pre-wrap text-sm">{selectedTicket.description}</p>
                  </div>
                  <div className="max-h-80 space-y-3 overflow-y-auto py-2">
                    {messagesLoading ? <p className="text-sm text-muted-foreground">Loading conversation…</p> : messages.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No replies yet. Our support team will respond here.</p>
                    ) : messages.map((message) => (
                      <div key={message.id} className={`rounded-xl p-3 text-sm ${message.sender_role === "admin" ? "mr-5 bg-muted" : "ml-5 bg-primary/10"}`}>
                        <div className="mb-1 flex justify-between gap-2 text-xs text-muted-foreground">
                          <span className="font-semibold">{message.sender_role === "admin" ? "NEXORA Support" : "You"}</span>
                          <span>{new Date(message.created_at).toLocaleString()}</span>
                        </div>
                        <p className="whitespace-pre-wrap">{message.message}</p>
                      </div>
                    ))}
                  </div>
                  {["resolved", "closed"].includes(selectedTicket.status) ? (
                    <p className="mt-4 rounded-lg bg-muted p-3 text-sm text-muted-foreground">This request is closed. Submit a new support request if you need more help.</p>
                  ) : (
                    <form onSubmit={sendReply} className="mt-4 flex items-end gap-2 border-t pt-4">
                      <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={2} maxLength={5000} required placeholder="Write a reply…" className="min-w-0 flex-1 resize-y rounded-lg border bg-background px-3 py-2 text-sm" />
                      <Button type="submit" size="icon" disabled={submitting || !reply.trim()} aria-label="Send reply"><Send size={16} /></Button>
                    </form>
                  )}
                </div>
              )}
            </div>
          )}
        </section>
      )}

      <section>
        <h2 className="mb-3 text-lg font-semibold">Frequently asked questions</h2>
        <input aria-label="Search help" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search help articles…" className="mb-3 w-full rounded-lg border bg-card px-4 py-3" />
        {results.map(([title, body]) => (
          <details key={title} className="border-b py-4">
            <summary className="cursor-pointer font-semibold">{title}</summary>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{body}</p>
          </details>
        ))}
        {!results.length && <p className="text-sm text-muted-foreground">No help articles match your search.</p>}
      </section>
    </div>
  );
}
