/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { Meta, StoryObj } from "@storybook/react-native";
import { SolicitudRow } from "./SolicitudRow";

const meta: Meta<typeof SolicitudRow> = {
  title: "Data/SolicitudRow",
  component: SolicitudRow
};

export default meta;

type Story = StoryObj<typeof SolicitudRow>;

export const Default: Story = {
  args: {
    name: "Rafael Antonio Peña",
    business: "Zapatería Peña · Villa Consuelo",
    meta: "Enviada hace 3h",
    riskLabel: "Bajo riesgo",
    riskVariant: "low",
    score: 91
  }
};

export const MediumRisk: Story = {
  args: {
    name: "Carmen Julia Ureña",
    business: "Repostería Carmen · Pantoja",
    meta: "Enviada hace 41 min",
    riskLabel: "Riesgo medio",
    riskVariant: "medium",
    score: 63
  }
};

export const HighRisk: Story = {
  args: {
    name: "Ángel Rosario",
    business: "Taller Rosario · Cancino",
    meta: "Enviada hace 1h",
    riskLabel: "Riesgo alto",
    riskVariant: "high",
    score: 38
  }
};
