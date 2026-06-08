/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { Meta, StoryObj } from "@storybook/react-vite";
import { LayoutDashboard, Inbox, Users, Wallet, Banknote, TrendingUp } from "lucide-react";
import { NavSidebar } from "./NavSidebar";

const meta = {
  title: "Components/NavSidebar",
  component: NavSidebar,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <div style={{ height: 720 }}>
        <Story />
      </div>
    )
  ]
} satisfies Meta<typeof NavSidebar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    items: [
      { icon: LayoutDashboard, label: "Inicio", active: true },
      { icon: Inbox, label: "Solicitudes" },
      { icon: Users, label: "Clientes" },
      { icon: Wallet, label: "Préstamos" },
      { icon: Banknote, label: "Contabilidad" },
      { icon: TrendingUp, label: "Reportes" }
    ],
    user: { name: "Rosa Méndez", role: "Manager", initials: "RM" }
  }
};
