export function uploadFileWithProgress(
  url: string,
  file: Blob,
  headers: Record<string, string>,
  onProgress: (loaded: number, total: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", url);
    Object.entries(headers).forEach(([name, value]) => request.setRequestHeader(name, value));
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) onProgress(event.loaded, event.total);
    });
    request.addEventListener("load", () => {
      if (request.status >= 200 && request.status < 300) {
        resolve();
        return;
      }

      const responseDetail = request.responseText
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 180);
      const status = [request.status, request.statusText].filter(Boolean).join(" ");
      reject(new Error(
        `Storage upload rejected (${status || "unknown HTTP status"})${responseDetail ? `: ${responseDetail}` : ""}.`,
      ));
    });
    request.addEventListener("error", () => {
      // A presigned URL contains temporary credentials in its query string.
      // Report only its hostname and the header names supplied by the app.
      let targetHost = "unknown";
      try {
        targetHost = new URL(url).hostname;
      } catch {
        // Keep the diagnostic safe if the URL cannot be parsed.
      }
      const requestHeaderNames = Object.keys(headers);
      const diagnostic = {
        status: request.status,
        statusText: request.statusText,
        readyState: request.readyState,
        targetHost,
        requestHeaderNames,
      };
      console.error("Media upload transport error", diagnostic);
      reject(new Error(
        `Network/CORS failure while contacting storage (status ${request.status || 0}, readyState ${request.readyState}). Target host: ${targetHost}. Upload header names: ${requestHeaderNames.join(", ") || "none"}. The browser could not complete the upload request.`,
      ));
    });
    request.addEventListener("abort", () => reject(new Error("Media upload was cancelled.")));
    request.addEventListener("timeout", () => reject(new Error("Storage upload timed out. Please retry on a stable connection.")));
    request.send(file);
  });
}
