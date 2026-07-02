/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { CSSProperties } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { SearchResultRow } from "./SearchResultRow";
import { applicationSignedEvent, paymentCollectedEvent, paymentReversedEvent } from "./fixtures";

// SearchResultRow's props are a discriminated union (per variant), which
// Storybook's `Meta<typeof meta>` args inference collapses to `never`. Typing
// the story directly against the component's props sidesteps that.
const meta: Meta<typeof SearchResultRow> = {
  title: "Components/Feed/SearchResultRow",
  component: SearchResultRow,
  parameters: { layout: "padded", backgrounds: { default: "ds-bg" } },
  decorators: [
    (Story) => (
      <div style={{ width: 640 }}>
        <Story />
      </div>
    )
  ]
};

export default meta;
type Story = StoryObj<typeof SearchResultRow>;

export const Cliente: Story = {
  args: {
    variant: "cliente",
    name: "Juana Peralta",
    phone: "809-555-0142",
    idNumber: "001-1234567-8",
    onSelect: () => {}
  }
};

export const ClienteSinMeta: Story = {
  name: "Cliente (sin teléfono ni cédula)",
  args: {
    variant: "cliente",
    name: "Juan Carlos Ureña",
    onSelect: () => {}
  }
};

export const Prestamo: Story = {
  args: {
    variant: "prestamo",
    loanNumber: 218,
    customerName: "Juana Peralta",
    statusLabel: "Activo",
    statusTone: "neutral",
    onSelect: () => {}
  }
};

export const PrestamoEnMora: Story = {
  name: "Préstamo (en mora)",
  args: {
    variant: "prestamo",
    loanNumber: 201,
    customerName: "Franklin Núñez",
    statusLabel: "En mora",
    statusTone: "red",
    onSelect: () => {}
  }
};

export const Evento: Story = {
  args: {
    variant: "evento",
    event: paymentCollectedEvent,
    onSelect: () => {}
  }
};

/** The three grouped result sections as they render on /founder/buscar. */
export const GroupedResults: Story = {
  args: { variant: "cliente", name: "", onSelect: () => {} },
  render: () => {
    const groupLabel: CSSProperties = {
      margin: "0 0 12px 0",
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: "0.8px",
      color: "#697A93"
    };
    const events = [paymentCollectedEvent, paymentReversedEvent, applicationSignedEvent];
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div>
          <p style={groupLabel}>CLIENTES · 1</p>
          <SearchResultRow
            variant="cliente"
            name="Juana Peralta"
            phone="809-555-0142"
            idNumber="001-1234567-8"
            onSelect={() => {}}
          />
        </div>
        <div>
          <p style={groupLabel}>PRÉSTAMOS · 1</p>
          <SearchResultRow
            variant="prestamo"
            loanNumber={218}
            customerName="Juana Peralta"
            statusLabel="Activo"
            statusTone="neutral"
            onSelect={() => {}}
          />
        </div>
        <div>
          <p style={groupLabel}>EN EL FEED · 3</p>
          <div
            style={{
              overflow: "hidden",
              borderRadius: 14,
              border: "1px solid #E5EAF1",
              background: "#FFFFFF"
            }}
          >
            {events.map((event, i) => (
              <SearchResultRow
                key={event.id}
                variant="evento"
                event={event}
                divider={i > 0}
                onSelect={() => {}}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }
};
