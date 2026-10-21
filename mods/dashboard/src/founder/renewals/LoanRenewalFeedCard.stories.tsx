/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { Meta, StoryObj } from "@storybook/react-vite";
import { LoanRenewalFeedCard } from "./LoanRenewalFeedCard";
import type { RenewalEvent } from "./renewalFeedLayout";

const RENEWAL_ID = "5b0f8f4e-8a0e-4b2a-9d6c-3f1f2a1c7e11";

function event(status: string, over: Partial<RenewalEvent["renewal"]> = {}): RenewalEvent {
  return {
    id: `ev-${status}`,
    type: "loan.renewal.started",
    occurredAt: new Date().toISOString(),
    actorName: "Ana R.",
    customerId: "7d2baa60-ac20-4d4c-9f8e-5b3b4c3e9a33",
    customerName: "Rosa Pérez",
    renewalId: RENEWAL_ID,
    summary: "Ana R. inició la renovación del préstamo #10034 de Rosa Pérez",
    payload: {},
    renewal: {
      status,
      oldLoanNumber: 10034,
      newLoanNumber: null,
      principal: 10000,
      termLength: 10,
      paymentAmount: 1300,
      paymentFrequency: "WEEKLY",
      quotedOwed: 2500,
      quotedNet: 7500,
      hasContract: false,
      hasSignedContract: false,
      cancelReason: null,
      createdById: "u1",
      ...over
    }
  };
}

const meta = {
  title: "Founder/Renewals/LoanRenewalFeedCard",
  component: LoanRenewalFeedCard,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div style={{ width: 1000 }}>
        <Story />
      </div>
    )
  ],
  args: { event: event("DRAFT"), onOpen: () => {}, onViewLoans: () => {}, onStartAnother: () => {} }
} satisfies Meta<typeof LoanRenewalFeedCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Draft: Story = {};

export const ContractReady: Story = {
  args: { event: event("CONTRACT_READY", { hasContract: true }) }
};

export const ReadyToFinalize: Story = {
  args: { event: event("SIGNED", { hasContract: true, hasSignedContract: true }) }
};

export const Completed: Story = {
  args: {
    event: event("COMPLETED", { hasContract: true, hasSignedContract: true, newLoanNumber: 10051 })
  }
};

export const Cancelled: Story = {
  args: { event: event("CANCELLED", { cancelReason: "El cliente se arrepintió" }) }
};

/** A renewal still open from an earlier day, pinned above the feed. */
export const PinnedFromAnotherDay: Story = {
  args: { event: event("CONTRACT_READY", { hasContract: true }), showDay: true }
};
