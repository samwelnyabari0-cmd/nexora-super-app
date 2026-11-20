import { afterEach, describe, expect, it, vi } from "vitest";
import { uploadFileWithProgress } from "./media-upload";

function stubXMLHttpRequest(request: MockUploadRequest) {
  vi.stubGlobal("XMLHttpRequest", class {
    constructor() {
      return request;
    }
  });
}

class MockUploadRequest {
  upload = { addEventListener: vi.fn() };
  status = 0;
  statusText = "";
  readyState = 4;
  responseText = "";
  listeners = new Map<string, (event?: ProgressEvent) => void>();
  open = vi.fn();
  setRequestHeader = vi.fn();
  addEventListener = vi.fn((type: string, listener: (event?: ProgressEvent) => void) => {
    this.listeners.set(type, listener);
  });
  send = vi.fn(() => this.listeners.get("error")?.());
}

describe("uploadFileWithProgress diagnostics", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("reports a browser-level network or CORS failure with transport details", async () => {
    const request = new MockUploadRequest();
    stubXMLHttpRequest(request)
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(
      uploadFileWithProgress("https://storage.example/signed-upload", new Blob(["video"]), {}, vi.fn()),
    ).rejects.toThrow(/Network\/CORS failure.*status 0.*readyState 4/i);

    expect(consoleError).toHaveBeenCalledWith(
      "Media upload transport error",
      expect.objectContaining({ status: 0, readyState: 4 }),
    );
    consoleError.mockRestore();
  });

  it("includes the HTTP status and storage response for rejected uploads", async () => {
    const request = new MockUploadRequest();
    request.status = 403;
    request.statusText = "Forbidden";
    request.responseText = "SignatureDoesNotMatch";
    request.send = vi.fn(() => request.listeners.get("load")?.());

    stubXMLHttpRequest(request)

    await expect(
      uploadFileWithProgress("https://storage.example/signed-upload", new Blob(["video"]), {}, vi.fn()),
    ).rejects.toThrow(/403 Forbidden.*SignatureDoesNotMatch/);
  });
});
