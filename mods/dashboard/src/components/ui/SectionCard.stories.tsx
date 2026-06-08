/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { Meta, StoryObj } from "@storybook/react-vite";
import { FileText } from "lucide-react";
import { SectionCard } from "./SectionCard";
import { KVRow } from "./KVRow";

const meta = {
  title: "Components/SectionCard",
  component: SectionCard,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div style={{ width: 880 }}>
        <Story />
      </div>
    )
  ]
} satisfies Meta<typeof SectionCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Collapsed: Story = {
  args: { icon: FileText, title: "Datos del préstamo", meta: "Resumen breve" }
};

export const Open: Story = {
  args: {
    icon: FileText,
    title: "Datos del préstamo",
    meta: "4 campos",
    open: true,
    children: (
      <>
        <KVRow label="Principal" value="RD$ 25,000" />
        <KVRow label="Plazo" value="12 cuotas" />
        <KVRow label="Frecuencia" value="Semanal" last />
      </>
    )
  }
};
