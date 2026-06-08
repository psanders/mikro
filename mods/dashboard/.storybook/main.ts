/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  framework: {
    name: "@storybook/react-vite",
    options: {}
  }
};

export default config;
