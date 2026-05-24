/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { Meta, StoryObj } from "@storybook/react-native";
import { History, RefreshCw, LogOut } from "lucide-react-native";
import { ListTile } from "./ListTile";

const meta: Meta<typeof ListTile> = {
  title: "Data/ListTile",
  component: ListTile
};

export default meta;

type Story = StoryObj<typeof ListTile>;

export const Historico: Story = { args: { icon: History, label: "Histórico de pagos" } };
export const Sincronizar: Story = { args: { icon: RefreshCw, label: "Sincronizar datos" } };
export const CerrarSesion: Story = { args: { icon: LogOut, label: "Cerrar sesión" } };
