/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { Meta, StoryObj } from "@storybook/react-native";
import { ClientRow } from "./ClientRow";

const meta: Meta<typeof ClientRow> = {
  title: "Data/ClientRow",
  component: ClientRow
};

export default meta;

type Story = StoryObj<typeof ClientRow>;

export const Default: Story = {
  args: {
    name: "María Rosa Peralta",
    business: "Colmado La Rosa · Calle Duarte",
    meta: "Hoy · Calle Duarte 24",
    amount: "RD$2,400"
  }
};

export const WithMora: Story = {
  args: {
    name: "José Núñez",
    business: "Motoconcho · Av. 27 de Febrero",
    meta: "Hoy · Calle 3ra #12",
    amount: "RD$2,400",
    amountSub: "+ mora"
  }
};

export const Overdue: Story = {
  args: {
    name: "Felipe Taveras",
    business: "Repuestos Taveras · Av. Las Carreras",
    meta: "Venció hace 6 días",
    amount: "RD$4,200",
    amountSub: "+ mora",
    variant: "overdue"
  }
};

export const Done: Story = {
  args: {
    name: "Pedro Cabrera",
    business: "Pica pollo La Esquina · El Sol",
    meta: "Cobrado · 9:14 AM",
    amount: "RD$1,800",
    variant: "done"
  }
};
