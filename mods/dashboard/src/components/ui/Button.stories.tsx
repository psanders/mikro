/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Download, Check } from "lucide-react";
import { Button } from "./Button";

const meta = {
  title: "Components/Button",
  component: Button,
  parameters: { layout: "centered" }
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: { variant: "primary", icon: Download, children: "Acción primaria" }
};

export const Secondary: Story = {
  args: { variant: "secondary", icon: Download, children: "Acción" }
};

export const Success: Story = {
  args: { variant: "success", icon: Check, children: "Confirmar" }
};

export const NoIcon: Story = {
  args: { variant: "primary", children: "Iniciar sesión" }
};

export const Block: Story = {
  args: { variant: "primary", block: true, children: "Iniciar sesión" },
  decorators: [
    (Story) => (
      <div style={{ width: 360 }}>
        <Story />
      </div>
    )
  ]
};
