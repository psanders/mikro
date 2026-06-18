/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Select } from "./Select";

const meta = {
  title: "Components/Select",
  component: Select,
  parameters: { layout: "centered", backgrounds: { default: "surface" } },
  render: (args) => (
    <Select {...args}>
      <option value="DAILY">Diaria</option>
      <option value="WEEKLY">Semanal</option>
      <option value="MONTHLY">Mensual</option>
    </Select>
  )
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { defaultValue: "WEEKLY" } };
export const FullWidth: Story = { args: { defaultValue: "WEEKLY", className: "w-full" } };
