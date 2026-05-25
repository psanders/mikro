/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { Meta, StoryObj } from "@storybook/react-native";
import { StatCard } from "./StatCard";

const meta: Meta<typeof StatCard> = {
  title: "Data/StatCard",
  component: StatCard
};

export default meta;

type Story = StoryObj<typeof StatCard>;

export const Cobrado: Story = { args: { value: "RD$18,240", label: "Cobrado hoy" } };
export const Pendiente: Story = { args: { value: "RD$4,800", label: "Pendiente" } };
export const Visitas: Story = { args: { value: "12", label: "Visitas" } };
