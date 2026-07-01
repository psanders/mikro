/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { Meta, StoryObj } from "@storybook/react-native";
import { Text } from "react-native";
import { RailCard } from "./RailCard";

const meta: Meta<typeof RailCard> = {
  title: "Layout/RailCard",
  component: RailCard
};

export default meta;

type Story = StoryObj<typeof RailCard>;

export const Default: Story = {
  args: {
    label: "DETALLES",
    children: <Text>Asignado a Ana Gómez</Text>
  }
};
