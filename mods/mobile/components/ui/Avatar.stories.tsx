/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { Meta, StoryObj } from "@storybook/react-native";
import { Avatar } from "./Avatar";

const meta: Meta<typeof Avatar> = {
  title: "Foundation/Avatar",
  component: Avatar
};

export default meta;

type Story = StoryObj<typeof Avatar>;

export const Initials: Story = { args: { name: "María Rosa Peralta" } };
export const SingleName: Story = { args: { name: "Carlos" } };
export const Large: Story = { args: { name: "Pedro Sanders", size: 64 } };
