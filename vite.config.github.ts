// GitHub Pages static SPA configuration, following the proven SindCoop deployment model.
// Keep vite.config.ts unchanged so the existing SSR/Cloudflare build remains available.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    spa: { enabled: true },
  },
  nitro: false,
  vite: {
    base: "/project-genesis/",
  },
});
