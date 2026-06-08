/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Inbox, Wallet, Banknote, Percent } from "lucide-react";
import { StatCard } from "./StatCard";

const meta = {
  title: "Components/StatCard",
  component: StatCard,
  parameters: { layout: "centered" },
  decorators: [
    (Story) => (
      <div style={{ width: 250 }}>
        <Story />
      </div>
    )
  ]
} satisfies Meta<typeof StatCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SolicitudesNuevas: Story = {
  args: {
    label: "Solicitudes nuevas",
    value: "24",
    icon: Inbox,
    delta: { text: "+12% vs. semana pasada", tone: "green" }
  }
};

export const CarteraTotal: Story = {
  args: {
    label: "Cartera total",
    value: "RD$ 2.4M",
    icon: Wallet,
    delta: { text: "+4% vs. mes pasado", tone: "green" }
  }
};

export const TasaDeMora: Story = {
  args: {
    label: "Tasa de mora",
    value: "4.2%",
    icon: Percent,
    delta: { text: "+0.3% vs. mes pasado", tone: "red" }
  }
};

export const Placeholder: Story = {
  args: { label: "Cobrado hoy", value: "RD$ 84K", icon: Banknote, placeholder: true }
};
