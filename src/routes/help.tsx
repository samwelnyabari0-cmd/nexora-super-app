import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/nexora/ui";
export const Route = createFileRoute("/help")({
  head: () => ({
    meta: [
      { title: "Help center — NEXORA" },
      {
        name: "description",
        content: "NEXORA help, permissions, demo limitations and connection requirements.",
      },
      { property: "og:title", content: "Help center — NEXORA" },
      {
        property: "og:description",
        content: "NEXORA help, permissions, demo limitations and connection requirements.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Help,
});
const answers = [
  [
    "Why won’t my microphone or camera work?",
    "Open NEXORA on HTTPS in a supported browser. Allow microphone or camera access in browser site settings. If another app is using the device, close it and retry. You can attach files instead. Some embedded browsers restrict recording; open the app directly in Safari or Chrome.",
  ],
  [
    "Can I send videos and files?",
    "Use the video or paperclip icon in Messages to choose files from your phone or computer. Preview and remove attachments before sending. Files up to 100 MB are supported for this local demo. Unsupported media formats show a preview error. No file is uploaded to a recipient.",
  ],
  [
    "Are messages delivered?",
    "No. Messages are saved in a session-only demo conversation on this device. Queued items can be synced locally after reconnecting. Real delivery requires user accounts, private storage, a messaging service and access controls. No automatic replies are generated.",
  ],
  [
    "Where are drafts and saved collections stored?",
    "Drafts, collections, messages, profile changes and safety settings exist only while this session is open. Refreshing clears them. Cross-device saving needs Lovable Cloud, account ownership and private storage; those services are not connected in this version.",
  ],
  [
    "What does private profile mean here?",
    "Private profile labels your demo identity as private, and private posts appear only in your local feed. No public profile or account service is connected. Muting removes a creator from your feed and search; it does not block a real account. Reports stay local until moderation is connected.",
  ],
  [
    "Are creator metrics real?",
    "No. Every chart and audience insight is sample data. Period filters change the sample window, not live analytics. Real analytics needs consent-aware event collection, account ownership, server aggregation and a connected analytics service.",
  ],
  [
    "Are AI, maps, streaming and wallet live?",
    "No. AI replies are scripted, places and map coordinates are samples, streaming titles are a demo catalog, and wallet transfers do not move money. Real providers require accounts, credentials and service-specific permissions.",
  ],
  [
    "What is required before a production launch?",
    "Connect Lovable Cloud for durable data, private file storage and user identity; add real messaging, moderation and consent-aware analytics. AI, maps, licensed streaming and regulated payments each require appropriate providers. Test privacy and account permissions before collecting real user data.",
  ],
];
function Help() {
  const [q, setQ] = useState("");
  const results = answers.filter((a) => a.join(" ").toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Help center" />
      <input
        aria-label="Search help"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search help…"
        className="mb-5 w-full rounded-lg border bg-card px-4 py-3"
      />
      {results.map(([title, body]) => (
        <details key={title} className="border-b py-4">
          <summary className="cursor-pointer font-semibold">{title}</summary>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{body}</p>
        </details>
      ))}
      {!results.length && <p>No help articles match your search.</p>}
    </div>
  );
}
