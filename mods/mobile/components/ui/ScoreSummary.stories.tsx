/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { Meta, StoryObj } from "@storybook/react-native";
import { ScoreSummary } from "./ScoreSummary";

const meta: Meta<typeof ScoreSummary> = {
  title: "Data/ScoreSummary",
  component: ScoreSummary
};

export default meta;

type Story = StoryObj<typeof ScoreSummary>;

export const Default: Story = {
  args: {
    name: "Carmen Julia Ureña",
    business: "Repostería Carmen · Pantoja",
    riskLabel: "Riesgo bajo",
    riskVariant: "low",
    score: 84
  }
};

export const MediumRisk: Story = {
  args: {
    name: "Ángel Rosario",
    business: "Taller Rosario · Cancino",
    riskLabel: "Riesgo medio",
    riskVariant: "medium",
    score: 58
  }
};

export const HighRisk: Story = {
  args: {
    name: "José Núñez",
    business: "Motoconcho · Av. 27 de Febrero",
    riskLabel: "Riesgo alto",
    riskVariant: "high",
    score: 31
  }
};
