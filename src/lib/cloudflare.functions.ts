import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const input = z.object({ title: z.string().trim().min(1).max(120) });

export const createLiveInput = createServerFn({ method: "POST" })
  .validator((value: unknown) => input.parse(value))
  .handler(async ({ data }) => {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const token = process.env.CLOUDFLARE_STREAM_TOKEN;
    if (!accountId || !token) return { error: "Live streaming is not configured." };

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/live_inputs`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ meta: { name: data.title } }),
      },
    );
    const payload = (await response.json()) as {
      success?: boolean;
      errors?: Array<{ message?: string }>;
      result?: {
        uid?: string;
        rtmps?: { url?: string; streamKey?: string };
        webRTC?: { url?: string };
        webRTCPlayback?: { url?: string };
      };
    };
    if (!response.ok || !payload.success || !payload.result?.uid) {
      return { error: payload.errors?.[0]?.message ?? "Could not create the live stream." };
    }
    return {
      uid: payload.result.uid,
      rtmpsUrl: payload.result.rtmps?.url ?? null,
      streamKey: payload.result.rtmps?.streamKey ?? null,
      whipUrl: payload.result.webRTC?.url ?? null,
      whepUrl: payload.result.webRTCPlayback?.url ?? null,
    };
  });
