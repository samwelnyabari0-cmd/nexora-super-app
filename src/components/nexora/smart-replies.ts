export type SmartReplyContextMessage = {
  sender: "You" | "Them" | "Member";
  body: string;
  media_path?: string | null;
  media_type?: string | null;
  location_latitude?: number | null;
  location_session_id?: string | null;
  shared_content_id?: string | null;
};

export function buildSmartReplyPrompt(messages: SmartReplyContextMessage[]): string {
  const recent = messages
    .filter((message) => typeof message.body === "string" && message.body.trim())
    .slice(-6)
    .map((message) => `${message.sender}: ${message.body.trim().slice(0, 500)}`);
  if (!recent.length) return "";
  return [
    "Suggest exactly three short, natural replies to the latest message in this chat.",
    "Keep each reply respectful and context-aware. Do not invent facts, commitments, or personal details.",
    "Return only three separate reply lines, with no numbering or explanation.",
    "Recent chat text:",
    ...recent,
  ].join("\n");
}

export function parseSmartReplySuggestions(text: string): string[] {
  const seen = new Set<string>();
  return text
    .split("\n")
    .map((line) => line.trim())
    .map((line) => line.replace(/^(?:[-*•]|\d+[.)])\s*/, "").replace(/^["'“”]|["'“”]$/g, "").trim())
    .filter((line) => line.length >= 2 && line.length <= 180)
    .filter((line) => !/^(here are|suggestions:|reply suggestions:)/i.test(line))
    .filter((line) => {
      const key = line.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 3);
}
