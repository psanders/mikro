/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { Meta, StoryObj } from "@storybook/react-vite";
import { KVRow } from "./KVRow";

const meta = {
  title: "Components/KVRow",
  component: KVRow,
  parameters: { backgrounds: { default: "surface" } },
  decorators: [
    (Story) => (
      <div style={{ width: 600 }}>
        <Story />
      </div>
    )
  ]
} satisfies Meta<typeof KVRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Strip: Story = {
  args: { label: "Principal", value: "RD$ 25,000" },
  render: () => (
    <div>
      <KVRow label="Principal" value="RD$ 25,000" />
      <KVRow label="Plazo" value="12 cuotas" />
      <KVRow label="Frecuencia" value="Semanal" />
      <KVRow label="Estado" value="Activo" last />
    </div>
  )
};
