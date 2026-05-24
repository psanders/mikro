/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { Meta, StoryObj } from "@storybook/react-native";
import { View } from "react-native";
import { Chip } from "./Chip";

const meta: Meta<typeof Chip> = {
  title: "Interactive/Chip",
  component: Chip,
  decorators: [
    (Story) => (
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Story />
      </View>
    )
  ]
};

export default meta;

type Story = StoryObj<typeof Chip>;

export const Default: Story = { args: { label: "Pendientes · 12" } };
export const Active: Story = { args: { label: "Todas · 20", active: true } };
export const Warning: Story = { args: { label: "Atrasadas · 4", variant: "warning" } };
export const Danger: Story = { args: { label: "Vencidos · 1", variant: "danger" } };
