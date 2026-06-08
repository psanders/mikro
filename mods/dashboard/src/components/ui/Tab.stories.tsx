/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Tab } from "./Tab";

const meta = {
  title: "Components/Tab",
  component: Tab,
  parameters: { layout: "centered", backgrounds: { default: "surface" } }
} satisfies Meta<typeof Tab>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Row: Story = {
  args: { children: "Todas" },
  render: () => (
    <div className="flex gap-1">
      <Tab active>Todas</Tab>
      <Tab>Nuevas</Tab>
      <Tab>En revisión</Tab>
      <Tab>Aprobadas</Tab>
    </div>
  )
};
