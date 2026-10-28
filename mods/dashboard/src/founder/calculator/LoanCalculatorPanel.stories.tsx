/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * The loan calculator panel (Pencil EzobQ sec-10). Prices come from
 * `getLoanPricing`; a stub tRPC link answers it with the default curve, never
 * answers (loading) or fails, per story.
 */
import { useState, type ReactNode } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TRPCClientError, type TRPCLink } from "@trpc/client";
import { observable } from "@trpc/server/observable";
import type { AppRouter } from "@mikro/apiserver";
import { DEFAULT_LOAN_PRICING } from "@mikro/common/utils/calculateLoan";
import { trpc } from "../../lib/trpc";
import { LoanCalculatorPanel } from "./LoanCalculatorPanel";

type PricingMode = "loaded" | "loading" | "failed";

function pricingLink(mode: PricingMode): TRPCLink<AppRouter> {
  return () => () =>
    observable((observer) => {
      if (mode === "loaded") {
        observer.next({ result: { type: "data", data: DEFAULT_LOAN_PRICING } });
        observer.complete();
      } else if (mode === "failed") {
        observer.error(new TRPCClientError("Failed to fetch"));
      }
    });
}

function StubTrpc({ mode, children }: { mode: PricingMode; children: ReactNode }) {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } })
  );
  const [client] = useState(() => trpc.createClient({ links: [pricingLink(mode)] }));
  return (
    <trpc.Provider client={client} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}

const meta: Meta<typeof LoanCalculatorPanel> = {
  title: "Ops/LoanCalculatorPanel",
  component: LoanCalculatorPanel,
  args: { onClose: () => {} },
  parameters: { layout: "fullscreen", pricing: "loaded" },
  decorators: [
    (Story, { parameters }) => (
      <StubTrpc mode={parameters.pricing as PricingMode}>
        <Story />
      </StubTrpc>
    )
  ]
};
export default meta;

type Story = StoryObj<typeof LoanCalculatorPanel>;

const weeklyCenteredAt9 = {
  principal: "10,000",
  paymentFrequency: "WEEKLY",
  baseDuration: "9"
} as const;

/** As opened from the feed: weekly, monto and plazo still empty. */
export const Empty: Story = {};

/** The spec's example (YtBtg): RD$ 10,000 · semanal · centered at 9. */
export const WeeklyExample: Story = {
  args: { initial: weeklyCenteredAt9 }
};

/** Invalid input (V9f4nY): monto cleared. */
export const InvalidMonto: Story = {
  args: { initial: { principal: "", paymentFrequency: "WEEKLY", baseDuration: "10" } }
};

/** Form valid, pricing still loading. */
export const PricingLoading: Story = {
  args: { initial: weeklyCenteredAt9 },
  parameters: { pricing: "loading" }
};

/** Form valid, pricing failed: no prices, Reintentar. */
export const PricingFailed: Story = {
  args: { initial: weeklyCenteredAt9 },
  parameters: { pricing: "failed" }
};
