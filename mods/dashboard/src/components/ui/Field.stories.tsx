/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Mail, Phone, Lock } from "lucide-react";
import { Field } from "./Field";

const meta = {
  title: "Components/Field",
  component: Field,
  parameters: { layout: "centered", backgrounds: { default: "surface" } },
  decorators: [
    (Story) => (
      <div style={{ width: 340 }}>
        <Story />
      </div>
    )
  ]
} satisfies Meta<typeof Field>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Email: Story = {
  args: { label: "Correo electrónico", icon: Mail, placeholder: "rosa@mikro.do" }
};

export const Phone_: Story = {
  args: { label: "Teléfono", icon: Phone, type: "tel", placeholder: "+1 809 555 0101" }
};

export const Password: Story = {
  args: { label: "Contraseña", icon: Lock, type: "password", placeholder: "••••••••" }
};

export const WithError: Story = {
  args: {
    label: "Teléfono",
    icon: Phone,
    defaultValue: "123",
    error: "Formato de teléfono inválido"
  }
};
