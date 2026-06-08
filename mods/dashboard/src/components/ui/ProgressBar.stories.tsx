/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { Meta, StoryObj } from "@storybook/react-vite";
import { ProgressBar } from "./ProgressBar";

const meta = {
  title: "Components/ProgressBar",
  component: ProgressBar,
  parameters: { layout: "centered", backgrounds: { default: "surface" } },
  decorators: [
    (Story) => (
      <div style={{ width: 340 }}>
        <Story />
      </div>
    )
  ]
} satisfies Meta<typeof ProgressBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { label: "Progreso de pago", value: "4 de 12 cuotas · 33%", percent: 33 }
};

export const Complete: Story = {
  args: { label: "Progreso de pago", value: "12 de 12 cuotas · 100%", percent: 100 }
};
