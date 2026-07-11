/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { Meta, StoryObj } from "@storybook/react-vite";
import { TaskActionCard } from "./TaskActionCard";
import type { TaskFiringInfo, TaskResultAttachment } from "./TaskActionCard";

const readyFiring: TaskFiringInfo = {
  id: "11111111-1111-4111-8111-111111111111",
  taskName: "Pago semanal Ana",
  automationId: "payment",
  status: "READY",
  askSlots: [
    {
      name: "amount",
      label: "Monto (RD$)",
      kind: "amount",
      optional: false,
      defaultFrom: "suggestedAmount"
    },
    { name: "note", label: "Nota (opcional)", kind: "text", optional: true }
  ],
  missingSlots: [],
  context: { collectorName: "Luis M.", weekCollected: 48300, weekPayments: 37 },
  payload: { suggestedAmount: 3500 }
};

const dailyCloseFiring: TaskFiringInfo = {
  id: "22222222-2222-4222-8222-222222222222",
  taskName: "Cierre contable del día",
  automationId: "daily-close",
  status: "READY",
  askSlots: [],
  missingSlots: [],
  context: { closeDate: "2026-07-05", dayCollected: 61250, dayPayments: 42 }
};

const needsInputFiring: TaskFiringInfo = {
  id: "33333333-3333-4333-8333-333333333333",
  taskName: "Pago semanal Ana",
  automationId: "payment",
  status: "NEEDS_INPUT",
  askSlots: [
    { name: "accountId", label: "Cuenta", kind: "account", optional: false },
    { name: "amount", label: "Monto (RD$)", kind: "amount", optional: false },
    { name: "note", label: "Nota (opcional)", kind: "text", optional: true }
  ],
  missingSlots: ["accountId"],
  context: {},
  reason: "La automatización cambió desde que se disparó; falta: accountId."
};

// Illustrative only — no v1 automation currently produces a resultAttachment
// (loan-statement, the only one that did, moved to an on-demand
// founder-copilot tool; see mikro/loan-statement-report spec). This fixture
// exercises the generic download-card capability against a hypothetical
// document-producing automation, kept for a future one.
const documentFiring: TaskFiringInfo = {
  id: "44444444-4444-4444-8444-444444444444",
  taskName: "Documento generado (ejemplo)",
  automationId: "example-document-automation",
  status: "READY",
  askSlots: [],
  missingSlots: [],
  context: {}
};

// Stubbed attachment — the story never actually downloads, it just proves
// the button renders once confirm resolves with an in-memory document (design
// D2: the bytes travel only in the confirm mutation's result, never persisted).
const documentAttachment: TaskResultAttachment = {
  filename: "documento-generado-2026-07-09.pdf",
  mimeType: "application/pdf",
  base64: "JVBERi0xLjQK" // stub — not a full valid PDF, just non-empty for the story
};

const meta = {
  title: "Components/Feed/TaskActionCard",
  component: TaskActionCard,
  parameters: { layout: "padded" },
  args: { onConfirm: () => {}, onSkip: () => {} },
  decorators: [
    (Story) => (
      <div style={{ width: 560, background: "#FFFBF0", padding: 16 }}>
        <Story />
      </div>
    )
  ]
} satisfies Meta<typeof TaskActionCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Ready: Story = {
  name: "Ready — payment (ask amount + note)",
  args: { firing: readyFiring }
};

export const ReadyNoAskSlots: Story = {
  name: "Ready — daily-close (no ask slots)",
  args: { firing: dailyCloseFiring }
};

export const NeedsInput: Story = {
  name: "Needs input — missing slot recoverable at confirm",
  args: { firing: needsInputFiring }
};

export const Submitting: Story = {
  args: { firing: readyFiring, submitting: true }
};

export const WithError: Story = {
  name: "Error — invalid value rejected, firing stays open",
  args: { firing: readyFiring, error: "Valores inválidos o faltantes: amount" }
};

export const ResolvedWithDownload: Story = {
  name: "Resolved — download a generated document (illustrative, no live automation)",
  args: {
    firing: documentFiring,
    resultAttachment: documentAttachment,
    onDownloadAttachment: () => {}
  }
};
