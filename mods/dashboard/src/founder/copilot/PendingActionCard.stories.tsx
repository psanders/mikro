/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { Meta, StoryObj } from "@storybook/react-vite";
import { PendingActionCard } from "./PendingActionCard";
import { paymentPendingAction } from "./fixtures";

const meta = {
  title: "Founder/Copilot/PendingActionCard",
  component: PendingActionCard,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div style={{ width: 398 }}>
        <Story />
      </div>
    )
  ]
} satisfies Meta<typeof PendingActionCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Pending: Story = {
  args: { action: paymentPendingAction, state: "pending" }
};

export const Confirmed: Story = {
  args: { action: paymentPendingAction, state: "confirmed" }
};

export const Rejected: Story = {
  args: { action: paymentPendingAction, state: "rejected" }
};

export const Expired: Story = {
  args: { action: paymentPendingAction, state: "expired" }
};
