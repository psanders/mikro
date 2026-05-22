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
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@mikro/calculate-loan": path.resolve(dir, "../mods/common/src/utils/calculateLoan.ts"),
      "@mikro/loan-calculator-constants": path.resolve(
        dir,
        "../mods/common/src/utils/loanCalculatorConstants.ts"
      )
    }
  }
});
