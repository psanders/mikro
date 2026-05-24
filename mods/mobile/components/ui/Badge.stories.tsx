/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { Meta, StoryObj } from "@storybook/react-native";
import { View } from "react-native";
import { Badge } from "./Badge";

const meta: Meta<typeof Badge> = {
  title: "Foundation/Badge",
  component: Badge,
  decorators: [
    (Story) => (
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        <Story />
      </View>
    )
  ]
};

export default meta;

type Story = StoryObj<typeof Badge>;

export const Default: Story = { args: { children: "Diario" } };
export const Success: Story = { args: { children: "Al día", variant: "success" } };
export const Warning: Story = { args: { children: "Atrasado", variant: "warning" } };
export const Danger: Story = { args: { children: "Mora", variant: "danger" } };
