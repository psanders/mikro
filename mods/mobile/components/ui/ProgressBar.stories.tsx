/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { Meta, StoryObj } from "@storybook/react-native";
import { View } from "react-native";
import { ProgressBar } from "./ProgressBar";

const meta: Meta<typeof ProgressBar> = {
  title: "Foundation/ProgressBar",
  component: ProgressBar,
  decorators: [
    (Story) => (
      <View style={{ width: 300 }}>
        <Story />
      </View>
    )
  ]
};

export default meta;

type Story = StoryObj<typeof ProgressBar>;

export const Quarter: Story = { args: { progress: 0.25 } };
export const Half: Story = { args: { progress: 0.5 } };
export const Full: Story = { args: { progress: 1 } };
export const Custom: Story = { args: { progress: 0.7, color: "#0E7C5F" } };
