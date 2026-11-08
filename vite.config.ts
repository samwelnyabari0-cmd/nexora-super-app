// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  vite: {
    define: {
      "import.meta.env.VITE_GOOGLE_MAPS_API_KEY": JSON.stringify(process.env.GOOGLE_MAPS_API_KEY ?? ""),
      "import.meta.env.VITE_VAPID_PUBLIC_KEY": JSON.stringify(process.env.VAPID_PUBLIC_KEY ?? ""),
      "import.meta.env.VITE_FIREBASE_API_KEY": JSON.stringify(process.env.FIREBASE_API_KEY ?? "BPt6cBmIxiQrFdzf5bVFhHhurDnMOKdU1kDSF7zCbb3Qs7X1b98iyqWJ0J1W7w4iXLlMlHrYlmKqG2GP_6okxxs"),
      "import.meta.env.VITE_FIREBASE_AUTH_DOMAIN": JSON.stringify(process.env.FIREBASE_AUTH_DOMAIN ?? "nexora-59c4e.firebaseapp.com"),
      "import.meta.env.VITE_FIREBASE_PROJECT_ID": JSON.stringify(process.env.FIREBASE_PROJECT_ID ?? "nexora-59c4e"),
      "import.meta.env.VITE_FIREBASE_STORAGE_BUCKET": JSON.stringify(process.env.FIREBASE_STORAGE_BUCKET ?? "nexora-59c4e.firebasestorage.app"),
      "import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID": JSON.stringify(process.env.FIREBASE_MESSAGING_SENDER_ID ?? "716195766292"),
      "import.meta.env.VITE_FIREBASE_APP_ID": JSON.stringify(process.env.FIREBASE_APP_ID ?? "1:716195766292:web:b3d20d1bc53141824bc701"),
    },
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
