// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { loadEnv } from "vite";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const env = loadEnv("development", process.cwd(), "");

export default defineConfig({
  vite: {
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(env.NEXT_PUBLIC_SUPABASE_URL ?? env.SUPABASE_URL ?? ""),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? env.SUPABASE_PUBLISHABLE_KEY ?? ""),
      "import.meta.env.VITE_GOOGLE_MAPS_API_KEY": JSON.stringify(env.GOOGLE_MAPS_API_KEY ?? ""),
      "import.meta.env.VITE_SUPABASE_REDIRECT_URL": JSON.stringify(env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ?? ""),
      "import.meta.env.VITE_HAS_PAYSTACK": JSON.stringify(Boolean(env.UDC_PAYSTACK_2_API_KEY)),
      "import.meta.env.VITE_HAS_CLOUDFLARE": JSON.stringify(Boolean(env.CLOUDFLARE_ACCOUNT_ID && env.CLOUDFLARE_STREAM_TOKEN)),
      "import.meta.env.VITE_HAS_AI": JSON.stringify(Boolean(env.VERCEL_OIDC_TOKEN || env.AI_GATEWAY_API_KEY)),
      "import.meta.env.VITE_HAS_SUPABASE": JSON.stringify(Boolean(env.NEXT_PUBLIC_SUPABASE_URL && (env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY))),
      "import.meta.env.VITE_VAPID_PUBLIC_KEY": JSON.stringify(env.VAPID_PUBLIC_KEY ?? ""),
      "import.meta.env.VITE_FIREBASE_API_KEY": JSON.stringify(env.FIREBASE_API_KEY ?? env.apiKey ?? ""),
      "import.meta.env.VITE_FIREBASE_AUTH_DOMAIN": JSON.stringify(env.FIREBASE_AUTH_DOMAIN ?? "nexora-59c4e.firebaseapp.com"),
      "import.meta.env.VITE_FIREBASE_PROJECT_ID": JSON.stringify(env.FIREBASE_PROJECT_ID ?? "nexora-59c4e"),
      "import.meta.env.VITE_FIREBASE_STORAGE_BUCKET": JSON.stringify(env.FIREBASE_STORAGE_BUCKET ?? "nexora-59c4e.firebasestorage.app"),
      "import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID": JSON.stringify(env.FIREBASE_MESSAGING_SENDER_ID ?? "716195766292"),
      "import.meta.env.VITE_FIREBASE_APP_ID": JSON.stringify(env.FIREBASE_APP_ID ?? "1:716195766292:web:b3d20d1bc53141824bc701"),
    },
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
