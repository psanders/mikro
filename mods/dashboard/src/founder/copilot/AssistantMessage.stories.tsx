/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { Meta, StoryObj } from "@storybook/react-vite";
import { AssistantMessage } from "./AssistantMessage";
import { analyzeProvenance } from "./fixtures";

const meta = {
  title: "Founder/Copilot/AssistantMessage",
  component: AssistantMessage,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div style={{ width: 398 }}>
        <Story />
      </div>
    )
  ]
} satisfies Meta<typeof AssistantMessage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithProvenance: Story = {
  args: {
    text: "La cobranza de hoy va en RD$ 48,500 — 62% de la meta. La ruta de Villa Consuelo es la más floja con 8.7% de mora.",
    provenance: analyzeProvenance
  }
};

export const WithoutProvenance: Story = {
  args: {
    text: "Claro, ¿de cuál préstamo quieres registrar el pago?"
  }
};

/** Markdown must render (bold/lists), not show literal `**`/`-` characters. */
export const WithMarkdown: Story = {
  args: {
    text: "Según el registro del feed, la solicitud de **Pedro Núñez** fue eliminada el **2 de julio de 2025 a las 4:39 PM** por **Admin User**.\n\n**Detalles de la solicitud eliminada:**\n\n- **Nombre:** Pedro Núñez\n- **Teléfono:** +18095551237\n- **Cédula:** 001-0234568-9\n- **Dirección:** Calle Principal 789\n- **Empleo:** Comerciante\n- **Ingresos:** RD$15,000\n- **Propietario de negocio:** Sí\n- **Día preferido de pago:** Lunes\n\nLa solicitud fue eliminada antes de ser aprobada y convertida en préstamo. No hay más detalles sobre el motivo de la eliminación en el registro."
  }
};
