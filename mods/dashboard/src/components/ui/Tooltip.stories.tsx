/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { Meta, StoryObj } from "@storybook/react-vite";
import { MessageSquare, House, Search } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Tooltip } from "./Tooltip";

const meta = {
  title: "Components/Tooltip",
  component: Tooltip,
  parameters: { layout: "centered" }
} satisfies Meta<typeof Tooltip>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A rail-shaped icon button, matching FounderShell's RailItem, for the story. */
function RailButton({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      className="flex h-10 w-10 items-center justify-center rounded-[11px] text-[#697A93] transition hover:bg-[#EEF3F9]"
    >
      <Icon size={19} strokeWidth={2} />
    </button>
  );
}

export const Feedback: Story = {
  args: {
    label: "Enviar feedback",
    children: <RailButton icon={MessageSquare} label="Enviar feedback" />
  }
};

/** Hover or tab to any icon to reveal its label — the whole rail uses this. */
export const Rail: Story = {
  args: { label: "Enviar feedback", children: null },
  render: () => (
    <div className="flex flex-col items-center gap-[14px] rounded-[14px] border border-[#E5EAF1] bg-white p-[18px]">
      <Tooltip label="Feed">
        <RailButton icon={House} label="Feed" />
      </Tooltip>
      <Tooltip label="Búsqueda">
        <RailButton icon={Search} label="Búsqueda" />
      </Tooltip>
      <Tooltip label="Enviar feedback">
        <RailButton icon={MessageSquare} label="Enviar feedback" />
      </Tooltip>
    </div>
  )
};
