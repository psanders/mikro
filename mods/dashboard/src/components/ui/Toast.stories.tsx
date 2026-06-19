/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Toast } from "./Toast";

const meta = {
  title: "Components/Toast",
  component: Toast,
  parameters: { layout: "centered" },
  args: { onDismiss: () => {} }
} satisfies Meta<typeof Toast>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Success: Story = {
  args: { variant: "success", message: "Operación completada exitosamente." }
};

export const Error: Story = {
  args: { variant: "error", message: "No se pudo completar la operación." }
};
