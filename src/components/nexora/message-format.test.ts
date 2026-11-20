import { describe, expect, it } from "vitest";
import {
  formatMessageTime,
  getMessageDateLabel,
  shouldShowDateDivider,
} from "./message-format";

describe("message date formatting", () => {
  it("formats compact 12-hour timestamps", () => {
    expect(formatMessageTime("2026-11-15T08:09:00")).toMatch(/8:09\s?AM/i);
    expect(formatMessageTime("2026-11-15T13:09:00")).toMatch(/1:09\s?PM/i);
  });

  it("labels today and yesterday", () => {
    const now = new Date(2026, 10, 15, 12);
    expect(getMessageDateLabel(new Date(2026, 10, 15, 8).toISOString(), now)).toBe("Today");
    expect(getMessageDateLabel(new Date(2026, 10, 14, 8).toISOString(), now)).toBe("Yesterday");
  });

  it("formats older dates with day, month and year", () => {
    const now = new Date(2026, 10, 15, 12);
    expect(getMessageDateLabel(new Date(2026, 10, 10, 8).toISOString(), now)).toBe("10 Nov 2026");
  });

  it("shows a divider only for the first message or a new calendar day", () => {
    expect(shouldShowDateDivider("2026-11-15T08:00:00")).toBe(true);
    expect(shouldShowDateDivider("2026-11-15T09:00:00", "2026-11-15T08:00:00")).toBe(false);
    expect(shouldShowDateDivider("2026-11-16T00:01:00", "2026-11-15T23:59:00")).toBe(true);
  });

  it("does not throw for malformed timestamps", () => {
    expect(formatMessageTime("invalid")).toBe("");
    expect(getMessageDateLabel("invalid")).toBe("");
    expect(shouldShowDateDivider("invalid", "also-invalid")).toBe(false);
  });
});
