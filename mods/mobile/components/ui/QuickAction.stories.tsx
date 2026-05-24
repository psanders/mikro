/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { Meta, StoryObj } from "@storybook/react-native";
import { MapPin, DollarSign, ClipboardList } from "lucide-react-native";
import { QuickAction } from "./QuickAction";
import { colors } from "../../lib/theme";

const meta: Meta<typeof QuickAction> = {
  title: "Interactive/QuickAction",
  component: QuickAction
};

export default meta;

type Story = StoryObj<typeof QuickAction>;

export const Ruta: Story = { args: { icon: MapPin, label: "Mi ruta" } };
export const Cobrar: Story = {
  args: { icon: DollarSign, label: "Cobrar", iconColor: colors.brand.blue.primary }
};
export const Cuadre: Story = {
  args: { icon: ClipboardList, label: "Cuadre", iconColor: colors.status.success }
};
