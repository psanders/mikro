/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { Meta, StoryObj } from "@storybook/react-native";
import { ChevronLeft, Settings, Phone } from "lucide-react-native";
import { IconButton } from "./IconButton";

const meta: Meta<typeof IconButton> = {
  title: "Interactive/IconButton",
  component: IconButton
};

export default meta;

type Story = StoryObj<typeof IconButton>;

export const Back: Story = { args: { icon: ChevronLeft } };
export const SettingsIcon: Story = { args: { icon: Settings } };
export const PhoneIcon: Story = { args: { icon: Phone } };
