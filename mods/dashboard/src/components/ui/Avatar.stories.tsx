/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Avatar } from "./Avatar";

const meta = {
  title: "Components/Avatar",
  component: Avatar,
  parameters: { layout: "centered", backgrounds: { default: "surface" } }
} satisfies Meta<typeof Avatar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { initials: "RM" } };
export const Large: Story = { args: { initials: "JP", size: 52 } };
