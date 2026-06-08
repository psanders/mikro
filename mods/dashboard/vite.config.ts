/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const dir = path.dirname(fileURLToPath(import.meta.url));

// The dashboard runs both as a plain web SPA and, wrapped by Tauri, as a desktop
// app. The build is identical for both — Tauri only points its webview at the
// same `dist/` output (see src-tauri/tauri.conf.json). Keep this config free of
// anything that would fork the two targets.
export default defineConfig({
  // Tauri's Rust process watches for these to coordinate the dev server.
  clearScreen: false,
  server: {
    // Distinct from `site` (5173) so both can run at once during development.
    port: 5174,
    strictPort: true
  },
  // Only VITE_-prefixed vars are exposed to the client (e.g. VITE_API_URL).
  envPrefix: ["VITE_"],
  plugins: [react(), tailwindcss()],
  resolve: {
    // Workspaces leave multiple React copies on disk. Pin react/react-dom to the
    // single hoisted root pair so the app has exactly one React instance —
    // otherwise hooks fail ("Invalid hook call"). Mirrors site/vite.config.ts.
    dedupe: ["react", "react-dom"],
    alias: {
      react: path.resolve(dir, "../../node_modules/react"),
      "react-dom": path.resolve(dir, "../../node_modules/react-dom")
    }
  }
});
