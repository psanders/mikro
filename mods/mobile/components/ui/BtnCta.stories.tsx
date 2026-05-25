/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { Meta, StoryObj } from "@storybook/react-native";
import { ArrowRight, Check } from "lucide-react-native";
import { BtnCta } from "./BtnCta";
import { colors } from "../../lib/theme";

const meta: Meta<typeof BtnCta> = {
  title: "Interactive/BtnCta",
  component: BtnCta
};

export default meta;

type Story = StoryObj<typeof BtnCta>;

export const Default: Story = { args: { label: "Continuar", icon: ArrowRight } };
export const Confirm: Story = { args: { label: "Confirmar y cobrar", icon: Check } };
export const Orange: Story = {
  args: { label: "Solicitar préstamo", color: colors.brand.orange.primary }
};
export const Disabled: Story = { args: { label: "Continuar", disabled: true } };
