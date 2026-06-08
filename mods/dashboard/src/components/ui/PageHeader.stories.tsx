/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Plus } from "lucide-react";
import { PageHeader } from "./PageHeader";
import { Button } from "./Button";

const meta = {
  title: "Components/PageHeader",
  component: PageHeader,
  parameters: { layout: "fullscreen" }
} satisfies Meta<typeof PageHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: "Solicitudes",
    subtitle: "Bandeja de evaluación de préstamos",
    action: (
      <Button variant="primary" icon={Plus}>
        Nueva solicitud
      </Button>
    )
  }
};

export const TitleOnly: Story = { args: { title: "Inicio" } };
