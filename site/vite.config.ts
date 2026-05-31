/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const dir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: process.env.VITE_BASE ?? "/",
  // Pin the dev server to a fixed port and fail loudly if it's taken, instead of
  // silently drifting to a random port (which leads to opening a stale server).
  server: {
    port: 5173,
    strictPort: true
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    // Workspaces leave two React copies on disk (root 19.2.x and site's own).
    // Pin both react and react-dom to the single matched root pair so the app
    // has exactly one React instance — otherwise hooks fail ("Invalid hook call").
    dedupe: ["react", "react-dom"],
    alias: {
      react: path.resolve(dir, "../node_modules/react"),
      "react-dom": path.resolve(dir, "../node_modules/react-dom"),
      "@mikro/calculate-loan": path.resolve(dir, "../mods/common/src/utils/calculateLoan.ts"),
      "@mikro/loan-calculator-constants": path.resolve(
        dir,
        "../mods/common/src/utils/loanCalculatorConstants.ts"
      )
    }
  }
});
