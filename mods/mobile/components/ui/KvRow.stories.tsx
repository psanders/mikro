/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { Meta, StoryObj } from "@storybook/react-native";
import { View } from "react-native";
import { KvRow } from "./KvRow";

const meta: Meta<typeof KvRow> = {
  title: "Data/KvRow",
  component: KvRow,
  decorators: [
    (Story) => (
      <View style={{ width: 300 }}>
        <Story />
      </View>
    )
  ]
};

export default meta;

type Story = StoryObj<typeof KvRow>;

export const Capital: Story = { args: { label: "Capital", value: "RD$2,400" } };
export const Interes: Story = { args: { label: "Interés", value: "RD$720" } };
export const Total: Story = { args: { label: "Total a pagar", value: "RD$3,120" } };
