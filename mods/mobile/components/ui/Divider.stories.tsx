/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { Meta, StoryObj } from "@storybook/react-native";
import { Divider } from "./Divider";

const meta: Meta<typeof Divider> = {
  title: "Foundation/Divider",
  component: Divider
};

export default meta;

type Story = StoryObj<typeof Divider>;

export const Default: Story = {};
