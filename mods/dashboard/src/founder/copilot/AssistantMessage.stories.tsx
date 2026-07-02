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
