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
