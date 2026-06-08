/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { Meta, StoryObj } from "@storybook/react-vite";
import { KVCell } from "./KVCell";

const meta = {
  title: "Components/KVCell",
  component: KVCell,
  parameters: { backgrounds: { default: "surface" } }
} satisfies Meta<typeof KVCell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Strip: Story = {
  args: { label: "Principal", value: "RD$ 25,000" },
  render: () => (
    <div className="flex w-[600px] overflow-hidden rounded-[10px] border border-ds-border bg-ds-bg">
      <KVCell label="Principal" value="RD$ 25,000" className="flex-1" />
      <KVCell label="Cuota" value="RD$ 2,400" className="flex-1" />
      <KVCell label="Plazo" value="12" className="flex-1" />
      <KVCell label="Mora" value="RD$ 0" className="flex-1" last />
    </div>
  )
};
