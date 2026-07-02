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
  initialValue = ""
}: {
  children?: ReactNode;
  busy?: boolean;
  initialValue?: string;
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
