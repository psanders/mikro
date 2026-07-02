/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { Meta, StoryObj } from "@storybook/react-vite";
import { FeedDayHeader } from "./FeedDayHeader";

const meta = {
  title: "Components/Feed/FeedDayHeader",
  component: FeedDayHeader,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div style={{ width: 400 }}>
        <Story />
      </div>
    )
  ]
} satisfies Meta<typeof FeedDayHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Today: Story = {
  args: { date: new Date().toISOString() }
};

export const Yesterday: Story = {
  args: { date: new Date(Date.now() - 24 * 60 * 60_000).toISOString() }
};

export const OlderDay: Story = {
  name: "Older day (24 de junio)",
  args: { date: new Date(2026, 5, 24).toISOString() }
};
