/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { Meta, StoryObj } from "@storybook/react-vite";
import { LoanFormCard } from "./LoanFormCard";
import type { CustomerPickerResult } from "./types";

const customers: CustomerPickerResult[] = [
  {
    id: "cust1",
    name: "Enersida Brito Estrella",
    phone: "809-555-1234",
    idNumber: "071-0047001-7",
    homeAddress: "San marco monterico"
  }
];

const meta = {
  title: "Founder/Copilot/LoanFormCard",
  component: LoanFormCard,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div style={{ width: 398 }}>
        <Story />
      </div>
    )
  ],
  args: {
    customers,
    onSearch: () => {},
    onCreate: () => {}
  }
} satisfies Meta<typeof LoanFormCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Idle: Story = {};

export const CustomerHint: Story = {
  args: { customerHint: "Enersida" }
};

export const Creating: Story = {
  args: { status: "creating" }
};

export const Done: Story = {
  args: { status: "done" }
};

export const Error: Story = {
  args: { status: "error", error: "No se pudo crear el préstamo. Inténtalo de nuevo." }
};
