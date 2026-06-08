/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Wallet } from "lucide-react";
import { SummaryCard } from "./SummaryCard";

const meta = {
  title: "Components/SummaryCard",
  component: SummaryCard,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div style={{ width: 880 }}>
        <Story />
      </div>
    )
  ]
} satisfies Meta<typeof SummaryCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    icon: Wallet,
    title: "Préstamo #10001",
    meta: "Rosa Pérez García · Semanal",
    items: [
      { label: "Principal", value: "RD$ 25,000" },
      { label: "Cuota", value: "RD$ 2,400" },
      { label: "Plazo", value: "12" },
      { label: "Mora", value: "RD$ 0" }
    ]
  }
};
