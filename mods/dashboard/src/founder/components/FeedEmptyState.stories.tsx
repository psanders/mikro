/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { Meta, StoryObj } from "@storybook/react-vite";
import { FeedEmptyState } from "./FeedEmptyState";

const meta = {
  title: "Components/Feed/FeedEmptyState",
  component: FeedEmptyState,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div style={{ width: 560 }}>
        <Story />
      </div>
    )
  ]
} satisfies Meta<typeof FeedEmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const SearchEmpty: Story = {
  name: "No results (search)",
  args: {
    title: "Sin resultados",
    description: "No encontramos clientes, préstamos ni eventos para esa búsqueda."
  }
};
