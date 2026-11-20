import { describe, expect, it } from "vitest";
import {
  formatAttachmentSize,
  isSupportedDocumentMime,
} from "./message-attachments";

describe("message document attachment helpers", () => {
  it("accepts only the supported office and PDF document types", () => {
    expect(isSupportedDocumentMime("application/pdf")).toBe(true);
    expect(isSupportedDocumentMime("application/msword")).toBe(true);
    expect(isSupportedDocumentMime("application/vnd.openxmlformats-officedocument.wordprocessingml.document")).toBe(true);
    expect(isSupportedDocumentMime("application/vnd.ms-excel")).toBe(true);
    expect(isSupportedDocumentMime("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")).toBe(true);
    expect(isSupportedDocumentMime("application/vnd.ms-powerpoint")).toBe(true);
    expect(isSupportedDocumentMime("application/vnd.openxmlformats-officedocument.presentationml.presentation")).toBe(true);
  });

  it("rejects executable, archive, HTML and unknown document types", () => {
    expect(isSupportedDocumentMime("application/x-msdownload")).toBe(false);
    expect(isSupportedDocumentMime("application/zip")).toBe(false);
    expect(isSupportedDocumentMime("text/html")).toBe(false);
    expect(isSupportedDocumentMime("application/octet-stream")).toBe(false);
  });

  it("formats file sizes readably and handles invalid sizes", () => {
    expect(formatAttachmentSize(0)).toBe("0 B");
    expect(formatAttachmentSize(1024)).toBe("1 KB");
    expect(formatAttachmentSize(1536)).toBe("1.5 KB");
    expect(formatAttachmentSize(1048576)).toBe("1 MB");
    expect(formatAttachmentSize(-1)).toBe("");
    expect(formatAttachmentSize(Number.NaN)).toBe("");
  });
});
