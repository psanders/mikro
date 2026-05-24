/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { Meta, StoryObj } from "@storybook/react-native";
import { View } from "react-native";
import { CuotaRow } from "./CuotaRow";

const meta: Meta<typeof CuotaRow> = {
  title: "Data/CuotaRow",
  component: CuotaRow,
  decorators: [
    (Story) => (
      <View style={{ gap: 6, width: "100%" }}>
        <Story />
      </View>
    )
  ]
};

export default meta;

type Story = StoryObj<typeof CuotaRow>;

export const Paid: Story = {
  args: { name: "Cuota 1", date: "20 abr", amount: "RD$2,400", status: "paid" }
};
export const Pending: Story = {
  args: { name: "Cuota 3", date: "4 may", amount: "RD$2,400", status: "pending" }
};
export const Overdue: Story = {
  args: { name: "Cuota 2", date: "27 abr", amount: "RD$2,400", status: "overdue" }
};
