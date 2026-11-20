import { describe, expect, it } from "vitest";
import { buildSmartReplyPrompt, parseSmartReplySuggestions } from "./smart-replies";

describe("smart reply suggestions", () => {
  it("sends only the latest six text messages with generic participant labels", () => {
    const prompt = buildSmartReplyPrompt(Array.from({ length: 8 }, (_, index) => ({
      sender: index % 2 ? "Them" : "You",
      body: `Message ${index}`,
    })));
    expect(prompt).toContain("Message 2");
    expect(prompt).toContain("Message 7");
    expect(prompt).not.toContain("Message 1");
    expect(prompt).not.toContain("Message 0");
    expect(prompt).not.toContain("Samwel");
  });

  it("excludes attachments, media, location and shared-content messages", () => {
    const prompt = buildSmartReplyPrompt([
      { sender: "Them", body: "Can we meet tomorrow?" },
      { sender: "You", body: "Shared a location", location_latitude: -1.2 },
      { sender: "Them", body: "See this video", media_type: "video", media_path: "clip.mp4" },
      { sender: "You", body: "Shared a post", shared_content_id: "post-123" },
      { sender: "Them", body: "I can meet at 3." },
    ]);
    expect(prompt).toContain("Can we meet tomorrow?");
    expect(prompt).toContain("I can meet at 3.");
    expect(prompt).not.toContain("Shared a location");
    expect(prompt).not.toContain("See this video");
    expect(prompt).not.toContain("Shared a post");
  });

  it("does not send empty chat context", () => {
    expect(buildSmartReplyPrompt([])).toBe("");
    expect(buildSmartReplyPrompt([{ sender: "Them", body: "  " }])).toBe("");
  });

  it("parses at most three concise unique suggestions", () => {
    expect(parseSmartReplySuggestions("1. Sounds good!\n2) Thanks for letting me know.\n- I will check and get back to you.\n4. Duplicate\n5. Another"))
      .toEqual(["Sounds good!", "Thanks for letting me know.", "I will check and get back to you."]);
  });

  it("removes explanatory headings and duplicate lines", () => {
    expect(parseSmartReplySuggestions("Here are three options:\nReply suggestions:\n- Okay\n- okay\n- Sure"))
      .toEqual(["Okay", "Sure"]);
  });
});
