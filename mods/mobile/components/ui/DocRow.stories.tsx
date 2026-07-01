/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { Meta, StoryObj } from "@storybook/react-native";
import { FileText } from "lucide-react-native";
import { DocRow } from "./DocRow";

const meta: Meta<typeof DocRow> = {
  title: "Data/DocRow",
  component: DocRow
};

export default meta;

type Story = StoryObj<typeof DocRow>;

export const Pending: Story = {
  args: { label: "Cédula (frente)" }
};

export const Uploaded: Story = {
  args: { label: "Cédula (frente)", actionLabel: "Ver", uploaded: true }
};

export const CustomIcon: Story = {
  args: { label: "Comprobante de ingresos", icon: FileText }
};
