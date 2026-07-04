/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { useState } from "react";
import type { ReactNode } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { AssistantMessage } from "./AssistantMessage";
import { CapabilityChips } from "./CapabilityChips";
import { CopilotDock } from "./CopilotDock";
import { RuleCard } from "./RuleCard";
import { UserBubble } from "./UserBubble";
import { activeRule, activeRuleNote, ruleProvenance } from "./fixtures";

/**
 * The dock is height-constrained here so the thread scrolls and the composer
 * pins to the foot, matching the panel in the export.
 */
function DockFrame({
  children,
  busy,
  initialValue = "",
  onClearHistory,
  clearing,
  initialConfirmingClear
}: {
  children?: ReactNode;
  busy?: boolean;
  initialValue?: string;
  onClearHistory?: () => void;
  clearing?: boolean;
  initialConfirmingClear?: boolean;
}) {
  const [value, setValue] = useState(initialValue);
  return (
    <div
      style={{ height: 760, display: "flex", justifyContent: "flex-end", background: "#FFFFFF" }}
    >
      <CopilotDock
        value={value}
        onChange={setValue}
        onSend={() => setValue("")}
        onClose={() => {}}
        busy={busy}
        onClearHistory={onClearHistory}
        clearing={clearing}
        initialConfirmingClear={initialConfirmingClear}
      >
        {children}
      </CopilotDock>
    </div>
  );
}

const meta = {
  title: "Founder/Copilot/CopilotDock",
  component: CopilotDock,
  parameters: { layout: "fullscreen" },
  // Required props satisfied here; each story drives its own state via `render`.
  args: { value: "", onChange: () => {}, onSend: () => {}, onClose: () => {} }
} satisfies Meta<typeof CopilotDock>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Empty thread: the four capability groups with example-prompt chips. */
export const EmptyWithCapabilities: Story = {
  render: () => (
    <DockFrame>
      <CapabilityChips onPick={() => {}} />
    </DockFrame>
  )
};

/**
 * The export's full thread: capability chips → founder question → assistant
 * reply carrying the "Regla activa" card and the crear_regla provenance line.
 */
export const RuleConversation: Story = {
  render: () => (
    <DockFrame>
      <CapabilityChips onPick={() => {}} />
      <UserBubble text="Avísame si la mora de una ruta pasa de 9%" />
      <AssistantMessage provenance={ruleProvenance}>
        <RuleCard rule={activeRule} note={activeRuleNote} />
      </AssistantMessage>
    </DockFrame>
  )
};

/** Composer prefilled from an ask-chip, request in flight (typing indicator). */
export const BusyWithPrefill: Story = {
  render: () => (
    <DockFrame busy initialValue="¿Cómo cerró la cobranza?">
      <UserBubble text="Mora por ruta" />
    </DockFrame>
  )
};

/** Default header: the eraser (clear-history) control sits left of close. */
export const WithClearHistoryButton: Story = {
  render: () => (
    <DockFrame onClearHistory={() => {}}>
      <UserBubble text="Avísame si la mora de una ruta pasa de 9%" />
      <AssistantMessage provenance={ruleProvenance}>
        <RuleCard rule={activeRule} note={activeRuleNote} />
      </AssistantMessage>
    </DockFrame>
  )
};

/** Clicking the eraser swaps the header for the inline "¿Borrar conversación?" confirm. */
export const ClearHistoryConfirm: Story = {
  render: () => (
    <DockFrame onClearHistory={() => {}} initialConfirmingClear>
      <UserBubble text="Avísame si la mora de una ruta pasa de 9%" />
      <AssistantMessage provenance={ruleProvenance}>
        <RuleCard rule={activeRule} note={activeRuleNote} />
      </AssistantMessage>
    </DockFrame>
  )
};

/** Blocked by an unresolved pending action: the container renders the refusal as an inline error bubble, same treatment as a failed confirm/reject. */
export const ClearHistoryBlocked: Story = {
  render: () => (
    <DockFrame onClearHistory={() => {}}>
      <UserBubble text="Registra 650 en el préstamo 10000"></UserBubble>
      <div className="w-full break-words rounded-[12px] border border-[#F3D2D2] bg-[#FEF6F6] px-[14px] py-[11px] text-[13px] font-medium leading-[20px] text-[#B42121]">
        Resuelve la acción pendiente antes de borrar el historial.
      </div>
    </DockFrame>
  )
};
