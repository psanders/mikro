/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { Meta, StoryObj } from "@storybook/react-native";
import { View } from "react-native";
import { BreakdownBar } from "./BreakdownBar";

const meta: Meta<typeof BreakdownBar> = {
  title: "Data/BreakdownBar",
  component: BreakdownBar,
  decorators: [
    (Story) => (
      <View style={{ width: 320 }}>
        <Story />
      </View>
    )
  ]
};

export default meta;

type Story = StoryObj<typeof BreakdownBar>;

export const Default: Story = {
  args: { label: "Capacidad de pago · 30%", value: "72/100", progress: 0.72 }
};

export const LowScore: Story = {
  args: {
    label: "Historial crediticio · 20%",
    value: "24/100",
    progress: 0.24,
    color: "#DC2626"
  }
};
