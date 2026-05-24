/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { Meta, StoryObj } from "@storybook/react-native";
import { PaymentRow } from "./PaymentRow";

const meta: Meta<typeof PaymentRow> = {
  title: "Data/PaymentRow",
  component: PaymentRow
};

export default meta;

type Story = StoryObj<typeof PaymentRow>;

export const Default: Story = {
  args: {
    day: "4",
    month: "MAY",
    title: "Cuota 3 · RD$2,400",
    subtitle: "Pago completo · Efectivo · Recibo #R-00872",
    amount: "RD$2,400",
    note: "sin mora"
  }
};

export const WithMora: Story = {
  args: {
    day: "28",
    month: "ABR",
    title: "Cuota 2 · RD$2,400",
    subtitle: "Pago completo · Transferencia",
    amount: "RD$2,640",
    note: "+ RD$240 mora"
  }
};
