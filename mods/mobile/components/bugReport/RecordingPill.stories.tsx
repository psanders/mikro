/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { Meta, StoryObj } from "@storybook/react-native";
import { View } from "react-native";
import { RecordingPill } from "./RecordingPill";

const meta: Meta<typeof RecordingPill> = {
  title: "BugReport/RecordingPill",
  component: RecordingPill,
  args: {
    elapsedSeconds: 14,
    onStop: () => {},
    onDiscard: () => {}
  },
  decorators: [
    (Story) => (
      <View style={{ padding: 20, backgroundColor: "#F4F8FF", alignItems: "center" }}>
        <Story />
      </View>
    )
  ]
};

export default meta;

type Story = StoryObj<typeof RecordingPill>;

// Both controls visible: discard (throw away) and stop-and-send.
export const Default: Story = {};

// Longer session — label rolls past a minute.
export const LongRecording: Story = { args: { elapsedSeconds: 187 } };
