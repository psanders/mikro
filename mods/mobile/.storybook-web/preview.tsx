/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { Preview } from "@storybook/react-vite";

const preview: Preview = {
  parameters: {
    layout: "centered",
    backgrounds: {
      default: "app",
      values: [
        { name: "app", value: "#F4F8FF" },
        { name: "white", value: "#FFFFFF" }
      ]
    }
  }
};

export default preview;
