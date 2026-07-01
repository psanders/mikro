/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { Meta, StoryObj } from "@storybook/react-native";
import { ActionCard } from "./ActionCard";

const meta: Meta<typeof ActionCard> = {
  title: "Interactive/ActionCard",
  component: ActionCard
};

export default meta;

type Story = StoryObj<typeof ActionCard>;

export const Review: Story = {
  args: {
    label: "REVISIÓN",
    body: "El negocio reporta 4 años operando en la misma dirección. Verifica la antigüedad con el vecino más cercano."
  }
};

export const Suggestion: Story = {
  args: {
    label: "PREGUNTA SUGERIDA",
    body: "¿Cuál es el gasto mensual promedio en inventario del negocio?"
  }
};
