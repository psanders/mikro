/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { Meta, StoryObj } from "@storybook/react-vite";
import { FeedErrorState } from "./FeedErrorState";

const meta = {
  title: "Components/Feed/FeedErrorState",
  component: FeedErrorState,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div style={{ width: 560 }}>
        <Story />
      </div>
    )
  ]
} satisfies Meta<typeof FeedErrorState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { onRetry: () => {} }
};

export const WithoutRetry: Story = {
  args: {}
};
