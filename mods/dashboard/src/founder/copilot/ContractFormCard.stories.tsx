/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { Meta, StoryObj } from "@storybook/react-vite";
import { ContractFormCard } from "./ContractFormCard";
import type { ContractCustomer } from "./types";

const customers: ContractCustomer[] = [
  {
    id: "aacd7997-8ebc-4875-8d70-6b1db5ef7bf1",
    name: "Enersida Brito Estrella",
    phone: "+18095551234",
    idNumber: "071-0047001-7",
    homeAddress: "San marco monterico"
  },
  {
    id: "b1c2d3e4-1111-2222-3333-444455556666",
    name: "Enerson Peña",
    phone: "+18095559876",
    idNumber: "071-0012345-6",
    homeAddress: "Los Cocos"
  }
];

const meta = {
  title: "Founder/Copilot/ContractFormCard",
  component: ContractFormCard,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div style={{ width: 398 }}>
        <Story />
      </div>
    )
  ],
  args: {
    customers: [],
    onSearch: () => {},
    onGenerate: () => {}
  }
} satisfies Meta<typeof ContractFormCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Fresh card: the founder searches for a customer to begin. */
export const Empty: Story = {};

/** Search-as-you-type surfaced two matches in the picker dropdown. */
export const SearchResults: Story = {
  args: { customers, customerHint: "Ener" }
};

/** Generating the PDF after the founder hit "Generá el contrato". */
export const Generating: Story = {
  args: { customers, status: "generating" }
};

/** The generate call failed; the error shows inline above the button. */
export const Error: Story = {
  args: {
    customers,
    status: "error",
    error: "No se pudo generar el contrato. Inténtalo de nuevo."
  }
};
