/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { StorybookConfig } from "@storybook/react-vite";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const nodeModules = resolve(__dirname, "../../../node_modules");

const config: StorybookConfig = {
  stories: ["../components/**/*.stories.tsx"],
  addons: [],
  framework: "@storybook/react-vite",
  viteFinal: (config) => {
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...config.resolve.alias,
      "react-native": resolve(nodeModules, "react-native-web/dist/index.js"),
      "lucide-react-native": resolve(nodeModules, "lucide-react"),
      "expo-router": resolve(__dirname, "stubs/expo-router.ts"),
      "react-native-safe-area-context": resolve(
        __dirname,
        "stubs/react-native-safe-area-context.ts"
      )
    };
    config.resolve.extensions = [".web.tsx", ".web.ts", ".web.js", ".tsx", ".ts", ".js"];
    return config;
  }
};

export default config;
