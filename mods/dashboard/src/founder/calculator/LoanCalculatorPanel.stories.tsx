/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * The loan calculator panel (Pencil EzobQ sec-10). Pure client-side, so every
 * state renders without a server.
 */
import type { Meta, StoryObj } from "@storybook/react-vite";
import { LoanCalculatorPanel } from "./LoanCalculatorPanel";

const meta: Meta<typeof LoanCalculatorPanel> = {
  title: "Ops/LoanCalculatorPanel",
  component: LoanCalculatorPanel,
  args: { onClose: () => {} },
  parameters: { layout: "fullscreen" }
};
export default meta;

type Story = StoryObj<typeof LoanCalculatorPanel>;

/** As opened from the feed: 30% weekly, monto and plazo still empty. */
export const Empty: Story = {};

/** The spec's example (YtBtg): RD$ 10,000 · 30% · semanal · 10. */
export const WeeklyExample: Story = {
  args: {
    initial: {
      principal: "10,000",
      ratePercent: "30",
      paymentFrequency: "WEEKLY",
      baseDuration: "10"
    }
  }
};

/** Invalid input (V9f4nY): monto cleared. */
export const InvalidMonto: Story = {
  args: {
    initial: { principal: "", ratePercent: "30", paymentFrequency: "WEEKLY", baseDuration: "10" }
  }
};
