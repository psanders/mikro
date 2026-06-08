/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { Preview } from "@storybook/react-vite";
import "../src/index.css";

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: "ds-bg",
      values: [
        { name: "ds-bg", value: "#F4F7FB" },
        { name: "surface", value: "#FFFFFF" }
      ]
    },
    controls: {
      matchers: { color: /(background|color)$/i, date: /Date$/i }
    }
  }
};

export default preview;
