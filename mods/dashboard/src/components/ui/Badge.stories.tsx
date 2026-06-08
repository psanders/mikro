/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Check, Clock, X } from "lucide-react";
import { Badge } from "./Badge";

const meta = {
  title: "Components/Badge",
  component: Badge,
  parameters: { layout: "centered", backgrounds: { default: "surface" } }
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Firmado: Story = { args: { tone: "green", icon: Check, children: "Firmado" } };
export const EnRevision: Story = { args: { tone: "amber", icon: Clock, children: "En revisión" } };
export const Rechazado: Story = { args: { tone: "red", icon: X, children: "Rechazado" } };
export const Neutral: Story = { args: { tone: "neutral", children: "Borrador" } };
