/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { Meta, StoryObj } from "@storybook/react-vite";
import { FeedCard } from "./FeedCard";
import { FeedDayHeader } from "./FeedDayHeader";
import {
  applicationApprovedEvent,
  applicationApprovedExceptionEvent,
  applicationConvertedEvent,
  applicationDeletedExpiredEvent,
  applicationDeletedRestorableEvent,
  applicationRejectedEvent,
  applicationRestoredEvent,
  applicationSignedEvent,
  customerCreatedEvent,
  loanStatusChangedEvent,
  paymentCollectedEvent,
  paymentCollectedWithLateFeeEvent,
  paymentReversedEvent
} from "./fixtures";

const meta = {
  title: "Components/Feed/FeedCard",
  component: FeedCard,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div style={{ width: 560 }}>
        <Story />
      </div>
    )
  ]
} satisfies Meta<typeof FeedCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PaymentCollected: Story = {
  args: { event: paymentCollectedEvent }
};

export const PaymentReversed: Story = {
  args: { event: paymentReversedEvent }
};

export const ApplicationApproved: Story = {
  args: { event: applicationApprovedEvent }
};

export const ApplicationApprovedPolicyException: Story = {
  name: "Application Approved — Policy Exception (amber)",
  args: { event: applicationApprovedExceptionEvent, defaultExpanded: true }
};

export const ApplicationRejected: Story = {
  args: { event: applicationRejectedEvent }
};

export const ApplicationSigned: Story = {
  args: { event: applicationSignedEvent }
};

export const ApplicationConverted: Story = {
  args: { event: applicationConvertedEvent, defaultExpanded: true }
};

export const ApplicationDeletedRestorable: Story = {
  name: "Application Deleted — Restaurar available (red)",
  args: { event: applicationDeletedRestorableEvent, canRestore: true, defaultExpanded: true }
};

export const ApplicationDeletedExpired: Story = {
  name: "Application Deleted — restore window expired (red)",
  args: { event: applicationDeletedExpiredEvent, canRestore: false, defaultExpanded: true }
};

export const ApplicationRestored: Story = {
  args: { event: applicationRestoredEvent }
};

export const LoanStatusChanged: Story = {
  args: { event: loanStatusChangedEvent, defaultExpanded: true }
};

export const CustomerCreated: Story = {
  args: { event: customerCreatedEvent }
};

export const PaymentCollectedExpandedWithLateFee: Story = {
  name: "Expanded — payment with late fee detail",
  args: { event: paymentCollectedWithLateFeeEvent, defaultExpanded: true }
};

/**
 * Day-grouped composite reproducing the Pencil feed column: a continuous list
 * of full-width rows (each its own bottom rule), today's events under the live
 * header and older days behind a day-separator band, with the payment,
 * copilot-origin, contract, exception and deletion treatments visible. A
 * couple of cards start expanded to show the KV detail + actions.
 */
export const Feed: Story = {
  args: { event: paymentCollectedEvent },
  render: () => {
    const today = [
      paymentCollectedEvent,
      applicationApprovedExceptionEvent,
      applicationSignedEvent,
      applicationDeletedRestorableEvent
    ];
    const yesterday = [
      paymentCollectedWithLateFeeEvent,
      paymentReversedEvent,
      applicationApprovedEvent,
      applicationConvertedEvent
    ];
    const older = [applicationRejectedEvent, loanStatusChangedEvent, customerCreatedEvent];

    return (
      <div style={{ width: 720, background: "#FFFFFF" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "15px 24px",
            borderBottom: "1px solid #E5EAF1"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span
              style={{ fontSize: 19, fontWeight: 700, color: "#14254A", letterSpacing: "-0.3px" }}
            >
              Hoy
            </span>
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: "#E8F7EE",
                borderRadius: 9999,
                padding: "4px 10px"
              }}
            >
              <span style={{ width: 7, height: 7, borderRadius: 9999, background: "#16A34A" }} />
              <span
                style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.6px", color: "#16A34A" }}
              >
                EN VIVO
              </span>
            </span>
          </div>
        </div>
        {today.map((event) => (
          <FeedCard
            key={event.id}
            event={event}
            canRestore={event === applicationDeletedRestorableEvent}
            defaultExpanded={event === applicationDeletedRestorableEvent}
          />
        ))}
        <FeedDayHeader date={new Date(Date.now() - 24 * 60 * 60_000).toISOString()} />
        {yesterday.map((event) => (
          <FeedCard
            key={event.id}
            event={event}
            defaultExpanded={event === paymentCollectedWithLateFeeEvent}
          />
        ))}
        <FeedDayHeader date={new Date(Date.now() - 8 * 24 * 60 * 60_000).toISOString()} />
        {older.map((event) => (
          <FeedCard key={event.id} event={event} />
        ))}
      </div>
    );
  }
};
