/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * The application card's building blocks. One color rule: violet while an
 * application is in progress, green/red only for the final outcome; the score
 * keeps its own risk scale.
 */
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Send, UserCheck, X } from "lucide-react";
import { Btn, ScoreChip, StatusPill } from "./ui";

const STATUSES = [
  "RECEIVED",
  "IN_REVIEW",
  "PENDING_DECISION",
  "APPROVED",
  "CONVERTED",
  "REJECTED",
  "ABANDONED",
  "DRAFT"
];

function Gallery() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <StatusPill key={s} status={s} />
        ))}
      </div>
      <div className="flex gap-2">
        <ScoreChip score={74} />
        <ScoreChip score={58} />
        <ScoreChip score={41} />
      </div>
      <div className="flex flex-wrap items-center gap-[10px]">
        <Btn tone="primary" icon={UserCheck}>
          Tomar
        </Btn>
        <Btn icon={Send} disabled>
          Enviar a decisión
        </Btn>
        <Btn icon={X}>Rechazar…</Btn>
        <Btn tone="success">Aprobar con estos términos</Btn>
      </div>
    </div>
  );
}

const meta = {
  title: "Components/Ops/Application building blocks",
  component: Gallery,
  parameters: { layout: "fullscreen" }
} satisfies Meta<typeof Gallery>;

export default meta;
type Story = StoryObj<typeof meta>;

export const All: Story = {};
