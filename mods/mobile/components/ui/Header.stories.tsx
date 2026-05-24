/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { Meta, StoryObj } from "@storybook/react-native";
import { Printer } from "lucide-react-native";
import { Header } from "./Header";

const meta: Meta<typeof Header> = {
  title: "Navigation/Header",
  component: Header
};

export default meta;

type Story = StoryObj<typeof Header>;

export const Default: Story = { args: { title: "Cliente" } };
export const WithSubtitle: Story = {
  args: { title: "Préstamo #L-00234", subtitle: "José Núñez · Motoconcho" }
};
export const CloseMode: Story = { args: { title: "Registrar cobro", backMode: "close" } };
export const WithAction: Story = { args: { title: "Histórico de pagos", rightIcon: Printer } };
