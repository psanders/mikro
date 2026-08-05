/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */

import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import prettierRecommended from "eslint-plugin-prettier/recommended";
import headers from "eslint-plugin-headers";

export default tseslint.config(
  {
    // Flat config does NOT read .gitignore, so every build output has to be
    // listed here too. Missing one is not a cosmetic slip: `eslint .` used to
    // hang indefinitely (>1h at 100% CPU) because it walked
    // mods/dashboard/storybook-static — 44 minified bundles including a 3.1M
    // single-line globals-runtime.js — and eslint-plugin-prettier tried to
    // reformat them. Keep this list in sync with .gitignore's output dirs.
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/*.d.ts",
      "**/coverage/**",
      "**/generated/**",
      "**/storybook-static/**",
      "**/src-tauri/target/**",
      "eval-results/**",
      "contracts/**",
      // Agent worktrees are full second checkouts of this repo; linting them
      // doubles the work and reports the same findings twice.
      "**/.claude/worktrees/**",
      "mods/mobile/metro.config.js",
      "mods/mobile/jest.config.js",
      "mods/mobile/.storybook/storybook.requires.ts"
    ]
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  prettierRecommended,
  {
    plugins: { headers },
    rules: {
      "headers/header-format": [
        "error",
        {
          source: "string",
          content: "Copyright (C) 2026 by Mikro SRL. MIT License."
        }
      ]
    }
  },
  {
    files: ["**/*.test.ts", "**/*.spec.ts", "**/test/**/*.ts"],
    rules: {
      "@typescript-eslint/no-unused-expressions": "off",
      "@typescript-eslint/no-explicit-any": "off"
    }
  },
  {
    // Flat-config `files` globs resolve against this config's directory, so a
    // bare ".scripts/**" only ever matched a repo-root .scripts/ — never
    // mods/mobile/.scripts/, whose scripts then failed no-undef on the very
    // globals this block exists to grant. Needs the leading "**/".
    files: ["**/.scripts/**/*.mjs", "**/bin/**/*.js"],
    languageOptions: {
      globals: {
        console: "readonly",
        process: "readonly"
      }
    }
  }
);
