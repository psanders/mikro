/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { Meta, StoryObj } from "@storybook/react-native";
import { View } from "react-native";
import { OptionRow } from "./OptionRow";

const meta: Meta<typeof OptionRow> = {
  title: "Interactive/OptionRow",
  component: OptionRow,
  decorators: [
    (Story) => (
      <View style={{ gap: 8, width: "100%" }}>
        <Story />
      </View>
    )
  ]
};

export default meta;

type Story = StoryObj<typeof OptionRow>;

export const Default: Story = { args: { label: "Sin contacto" } };
export const Selected: Story = { args: { label: "Pago completo", selected: true } };
export const WithValue: Story = {
  args: { label: "Pago parcial", value: "RD$3,150", selected: true }
};
