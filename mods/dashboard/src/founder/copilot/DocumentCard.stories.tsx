/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { Meta, StoryObj } from "@storybook/react-vite";
import { DocumentCard } from "./DocumentCard";

const meta = {
  title: "Founder/Copilot/DocumentCard",
  component: DocumentCard,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div style={{ width: 398 }}>
        <Story />
      </div>
    )
  ]
} satisfies Meta<typeof DocumentCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Idle: Story = {
  args: {
    filename: "estado-cuenta-10036-2026-07-10.pdf",
    status: "idle",
    onDownload: () => {}
  }
};

export const Saving: Story = {
  args: {
    filename: "estado-cuenta-10036-2026-07-10.pdf",
    status: "saving",
    onDownload: () => {}
  }
};

export const Done: Story = {
  args: {
    filename: "estado-cuenta-10036-2026-07-10.pdf",
    status: "done",
    onDownload: () => {}
  }
};

export const Error: Story = {
  args: {
    filename: "estado-cuenta-10036-2026-07-10.pdf",
    status: "error",
    error: "No se pudo guardar el archivo. Inténtalo de nuevo.",
    onDownload: () => {}
  }
};
