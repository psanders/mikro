/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { Meta, StoryObj } from "@storybook/react-native";
import { Check } from "lucide-react-native";
import { colors } from "../../lib/theme";
import { BtnOutline } from "./BtnOutline";

const meta: Meta<typeof BtnOutline> = {
  title: "Interactive/BtnOutline",
  component: BtnOutline
};

export default meta;

type Story = StoryObj<typeof BtnOutline>;

export const Rechazar: Story = { args: { label: "Rechazar" } };
export const Aprobar: Story = {
  args: { label: "Aprobar", icon: Check, color: colors.status.success }
};
export const Disabled: Story = { args: { label: "Rechazar", disabled: true } };
