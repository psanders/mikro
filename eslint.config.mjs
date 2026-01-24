/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */

import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import prettierRecommended from "eslint-plugin-prettier/recommended";
import headers from "eslint-plugin-headers";

export default tseslint.config(
  {
    ignores: ["**/dist/**", "**/node_modules/**", "**/*.d.ts", "**/coverage/**", "**/generated/**"]
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
  }
);
