/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { Meta, StoryObj } from "@storybook/react-vite";
import { RecordingPill } from "./RecordingPill";

const meta = {
  title: "Components/RecordingPill",
  component: RecordingPill,
  parameters: { layout: "centered" },
  args: {
    elapsedSeconds: 14,
    onStop: () => {},
    onDiscard: () => {}
  },
  // The pill floats over app content on a light background; give the canvas one.
  decorators: [
    (Story) => (
      <div style={{ padding: 32, background: "#F4F8FF" }}>
        <Story />
      </div>
    )
  ]
} satisfies Meta<typeof RecordingPill>;

export default meta;
type Story = StoryObj<typeof meta>;

// Both controls visible: discard (throw away) and stop-and-send.
export const Default: Story = {};

// Longer session — label rolls past a minute.
export const LongRecording: Story = { args: { elapsedSeconds: 187 } };
