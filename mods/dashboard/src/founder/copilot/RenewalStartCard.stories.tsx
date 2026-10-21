/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { Meta, StoryObj } from "@storybook/react-vite";
import { RenewalStartCard } from "./RenewalStartCard";

const meta = {
  title: "Founder/Copilot/RenewalStartCard",
  component: RenewalStartCard,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div style={{ width: 398 }}>
        <Story />
      </div>
    )
  ],
  args: { onStart: () => {}, onOpen: () => {} }
} satisfies Meta<typeof RenewalStartCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** No loan named yet: the card asks for the loan number. */
export const PickLoan: Story = {};

/** The founder named the loan, so the number is pre-filled. */
export const Prefilled: Story = { args: { loanId: 10034 } };

export const Starting: Story = { args: { loanId: 10034, status: "starting" } };

export const Error: Story = {
  args: {
    loanId: 10034,
    status: "error",
    error: "Solo se puede renovar un préstamo activo (#10034 está COMPLETED)."
  }
};

/** Started (or an existing renewal was found): open the panel from here. */
export const Started: Story = {
  args: {
    loanId: 10034,
    status: "started",
    started: {
      renewalId: "5b0f8f4e-8a0e-4b2a-9d6c-3f1f2a1c7e11",
      status: "CONTRACT_READY",
      loanNumber: 10034,
      customerName: "Enersida Brito Estrella"
    }
  }
};
