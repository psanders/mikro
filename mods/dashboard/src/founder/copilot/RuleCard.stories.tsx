/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { Meta, StoryObj } from "@storybook/react-vite";
import { RuleCard } from "./RuleCard";
import { activeRule, activeRuleNote, disabledRule } from "./fixtures";

const meta = {
  title: "Founder/Copilot/RuleCard",
  component: RuleCard,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div style={{ width: 398 }}>
        <Story />
      </div>
    )
  ]
} satisfies Meta<typeof RuleCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Active: Story = {
  args: { rule: activeRule, note: activeRuleNote }
};

export const Disabled: Story = {
  args: { rule: disabledRule }
};
