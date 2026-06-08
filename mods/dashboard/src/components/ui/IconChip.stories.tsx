/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Calendar, Wallet } from "lucide-react";
import { IconChip } from "./IconChip";

const meta = {
  title: "Components/IconChip",
  component: IconChip,
  parameters: { layout: "centered", backgrounds: { default: "surface" } }
} satisfies Meta<typeof IconChip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Small: Story = { args: { icon: Calendar, size: "sm" } };
export const Large: Story = { args: { icon: Wallet, size: "lg" } };
