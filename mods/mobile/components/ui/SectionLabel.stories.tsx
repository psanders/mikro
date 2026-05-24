/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { Meta, StoryObj } from "@storybook/react-native";
import { SectionLabel } from "./SectionLabel";

const meta: Meta<typeof SectionLabel> = {
  title: "Foundation/SectionLabel",
  component: SectionLabel
};

export default meta;

type Story = StoryObj<typeof SectionLabel>;

export const Default: Story = { args: { children: "SECCIÓN" } };
export const Custom: Story = { args: { children: "PRÓXIMOS COBROS" } };
