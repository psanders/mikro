/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { Meta, StoryObj } from "@storybook/react-vite";
import { GroupedFeedRow } from "./GroupedFeedRow";
import { groupedPaymentRun } from "./fixtures";

const meta = {
  title: "Components/Feed/GroupedFeedRow",
  component: GroupedFeedRow,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div style={{ width: 560 }}>
        <Story />
      </div>
    )
  ]
} satisfies Meta<typeof GroupedFeedRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CollapsedRun: Story = {
  name: "5 pagos recibidos (collapsed)",
  args: { events: groupedPaymentRun }
};

export const TwoEventRun: Story = {
  name: "Minimum run (2 events)",
  args: { events: groupedPaymentRun.slice(0, 2) }
};
