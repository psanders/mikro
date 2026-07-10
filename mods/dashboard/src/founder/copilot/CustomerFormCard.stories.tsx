/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { Meta, StoryObj } from "@storybook/react-vite";
import { CustomerFormCard } from "./CustomerFormCard";
import type { CollectorOption } from "./types";

const collectors: CollectorOption[] = [
  { id: "c1", name: "Luis Peña" },
  { id: "c2", name: "María Ruiz" }
];

const meta = {
  title: "Founder/Copilot/CustomerFormCard",
  component: CustomerFormCard,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div style={{ width: 398 }}>
        <Story />
      </div>
    )
  ],
  args: {
    collectors,
    onCreate: () => {}
  }
} satisfies Meta<typeof CustomerFormCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Idle: Story = {};

export const Creating: Story = {
  args: { status: "creating" }
};

export const Done: Story = {
  args: { status: "done" }
};

export const Error: Story = {
  args: { status: "error", error: "No se pudo crear el cliente. Inténtalo de nuevo." }
};
