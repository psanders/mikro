/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Images, Landmark } from "lucide-react";
import { SidePanel } from "./SidePanel";

const meta = {
  title: "Components/Ops/SidePanel",
  component: SidePanel,
  parameters: { layout: "fullscreen" },
  args: { open: true, onClose: () => {} }
} satisfies Meta<typeof SidePanel>;

export default meta;
type Story = StoryObj<typeof meta>;

const footer = (
  <>
    <span className="flex-1 text-[12px] font-semibold text-[#D97706]">
      Falta: cédula (reverso) · 1 foto del negocio
    </span>
    <button
      type="button"
      className="rounded-[9px] bg-[#1F4AA8] px-4 py-[9px] text-[14px] text-white"
    >
      Listo
    </button>
  </>
);

/** A top-level view: title, subtitle, close. */
export const Detail: Story = {
  args: {
    title: "Yokasta Díaz",
    subtitle: "Salón Yoka",
    icon: Images,
    children: <p className="text-sm text-[#697A93]">Contenido de la solicitud…</p>
  }
};

/** A nested view: back crumb to the application, pinned footer with the actions. */
export const NestedWithFooter: Story = {
  args: {
    title: "Evidencia",
    subtitle: "Salón Yoka · Yokasta Díaz",
    icon: Images,
    onBack: () => {},
    backLabel: "Solicitud de Yokasta Díaz",
    footer,
    children: <p className="text-sm text-[#697A93]">Cédula, fotos del negocio, otros documentos…</p>
  }
};

export const Disbursement: Story = {
  args: {
    title: "Registrar desembolso",
    subtitle: "Ferretería Aprobada · Rafael Peña",
    icon: Landmark,
    onBack: () => {},
    backLabel: "Solicitud de Rafael Peña",
    children: <p className="text-sm text-[#697A93]">Términos, cobrador, cuenta de origen…</p>
  }
};
