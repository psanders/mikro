/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { Meta, StoryObj } from "@storybook/react-vite";
import { RenewalFormCard } from "./RenewalFormCard";
import { renewalAccounts, renewalQuote } from "./fixtures";

const meta = {
  title: "Founder/Copilot/RenewalFormCard",
  component: RenewalFormCard,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div style={{ width: 398 }}>
        <Story />
      </div>
    )
  ],
  args: {
    accounts: renewalAccounts,
    onLoadQuote: () => {},
    onRenew: () => {}
  }
} satisfies Meta<typeof RenewalFormCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** No loan named yet: the card asks for the loan number. */
export const PickLoan: Story = {};

export const QuoteLoading: Story = {
  args: { loanId: 10034, quoteStatus: "loading" }
};

export const QuoteError: Story = {
  args: {
    quoteStatus: "error",
    quoteError: "Solo se puede renovar un préstamo activo (#10034 está COMPLETED)."
  }
};

/** Quote loaded: payoff and the new terms pre-filled from the current loan. */
export const Ready: Story = {
  args: { loanId: 10034, quote: renewalQuote, quoteStatus: "ready" }
};

/** Payoff not below the new principal: the net line turns red and submit disables. */
export const NetInvalid: Story = {
  args: {
    loanId: 10034,
    quote: { ...renewalQuote, suggestedPayoff: 12000 },
    quoteStatus: "ready"
  }
};

export const Renewing: Story = {
  args: { ...Ready.args, status: "creating" }
};

export const Done: Story = {
  args: {
    ...Ready.args,
    status: "done",
    outcome: { oldLoanId: 10034, newLoanId: 10051, netDisbursed: 7200, accountName: "Caja General" }
  }
};

export const Error: Story = {
  args: {
    ...Ready.args,
    status: "error",
    error: "El préstamo #10034 cambió mientras lo renovabas; recarga e intenta de nuevo."
  }
};
