import { describe, expect, it, vi } from "vitest";
import {
  DOCUMENT_MIME_TYPES,
  formatAttachmentSize,
  safeAttachmentName,
  uploadThenInsertAttachment,
  validateDocumentFile,
} from "./message-attachments";

describe("private document attachment rules", () => {
  it("accepts the seven supported document formats", () => {
    const extensions = ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx"];
    DOCUMENT_MIME_TYPES.forEach((type, index) => {
      expect(validateDocumentFile({ type, name: `report.${extensions[index]}`, size: 1024 })).toEqual({
        ok: true,
        extension: extensions[index],
      });
    });
  });

  it("rejects executable, archive, HTML, unknown and mismatched files", () => {
    for (const type of ["application/x-msdownload", "application/zip", "text/html", "application/octet-stream"]) {
      expect(validateDocumentFile({ type, name: "file.bin", size: 1024 }).ok).toBe(false);
    }
    expect(validateDocumentFile({ type: "application/pdf", name: "file.exe", size: 1024 }).ok).toBe(false);
  });

  it("enforces non-empty files and the 50 MiB limit", () => {
    expect(validateDocumentFile({ type: "application/pdf", name: "a.pdf", size: 0 }).ok).toBe(false);
    expect(validateDocumentFile({ type: "application/pdf", name: "a.pdf", size: 50 * 1024 * 1024 + 1 }).ok).toBe(false);
  });

  it("formats file sizes and sanitizes unsafe filenames", () => {
    expect(formatAttachmentSize(0)).toBe("0 B");
    expect(formatAttachmentSize(1536)).toBe("1.5 KB");
    expect(formatAttachmentSize(2 * 1024 * 1024)).toBe("2.0 MB");
    expect(safeAttachmentName("../../report\u0000.pdf")).toBe("report.pdf");
    expect(safeAttachmentName("")).toBe("Shared document");
  });

  it("does not insert a message after upload failure", async () => {
    const insert = vi.fn(async () => ({ error: null }));
    const rollback = vi.fn(async () => undefined);
    const result = await uploadThenInsertAttachment(
      async () => ({ error: new Error("upload failed") }),
      insert,
      rollback,
    );
    expect(result.error).toBeInstanceOf(Error);
    expect(insert).not.toHaveBeenCalled();
    expect(rollback).not.toHaveBeenCalled();
  });

  it("removes an uploaded object if message insertion fails", async () => {
    const rollback = vi.fn(async () => undefined);
    const result = await uploadThenInsertAttachment(
      async () => ({ error: null }),
      async () => ({ error: new Error("insert failed") }),
      rollback,
    );
    expect(result.error).toBeInstanceOf(Error);
    expect(rollback).toHaveBeenCalledOnce();
  });
});
