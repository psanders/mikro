/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { Meta, StoryObj } from "@storybook/react-vite";
import { TaskFormModal } from "./TaskFormModal";
import type { TaskAutomationOption } from "./TaskFormModal";

const automations: TaskAutomationOption[] = [
  {
    id: "pay-collector",
    title: "Pagar cobrador",
    gateFloor: "confirm",
    slots: [
      {
        name: "collectorId",
        label: "Cobrador",
        source: "static",
        kind: "collector",
        optional: false
      },
      { name: "accountId", label: "Cuenta", source: "static", kind: "account", optional: false },
      {
        name: "categoryId",
        label: "Categoría",
        source: "static",
        kind: "category",
        optional: false
      },
      { name: "amount", label: "Monto (RD$)", source: "ask", kind: "amount", optional: false },
      { name: "note", label: "Nota (opcional)", source: "ask", kind: "text", optional: true }
    ]
  },
  {
    id: "record-expense",
    title: "Registrar gasto",
    gateFloor: "confirm",
    slots: [
      { name: "concept", label: "Concepto", source: "static", kind: "text", optional: false },
      { name: "accountId", label: "Cuenta", source: "static", kind: "account", optional: false },
      {
        name: "categoryId",
        label: "Categoría",
        source: "static",
        kind: "category",
        optional: false
      },
      { name: "amount", label: "Monto (RD$)", source: "ask", kind: "amount", optional: false },
      { name: "note", label: "Nota (opcional)", source: "ask", kind: "text", optional: true }
    ]
  },
  {
    id: "daily-close",
    title: "Cierre contable del día",
    gateFloor: "confirm",
    slots: [
      {
        name: "accountId",
        label: "Cuenta destino",
        source: "static",
        kind: "account",
        optional: false
      },
      {
        name: "closeDate",
        label: "Fecha a cerrar",
        source: "computed",
        kind: "text",
        optional: false
      }
    ]
  }
];

const collectors = [
  { id: "u-1", name: "Luis M." },
  { id: "u-2", name: "Marta R." }
];
const accounts = [
  { id: "a-1", name: "Caja principal" },
  { id: "a-2", name: "Banco Popular" }
];
const categories = [
  { id: "c-1", name: "Comisiones" },
  { id: "c-2", name: "Combustible" }
];

const meta = {
  title: "Components/Tareas/TaskFormModal",
  component: TaskFormModal,
  parameters: { layout: "fullscreen" },
  args: {
    automations,
    collectors,
    accounts,
    categories,
    onSubmit: () => {},
    onClose: () => {}
  }
} satisfies Meta<typeof TaskFormModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Create: Story = {};

export const CreateDailyClose: Story = {
  name: "Create — daily-close (computed date, no ask slots)",
  args: {
    initial: { automationId: "daily-close", frequency: "daily", timeOfDay: "07:00" }
  }
};

export const Edit: Story = {
  args: {
    mode: "edit",
    initial: {
      name: "Pago semanal — Luis M.",
      automationId: "pay-collector",
      frequency: "weekly",
      weekday: 5,
      timeOfDay: "08:00",
      staticParams: { collectorId: "u-1", accountId: "a-1", categoryId: "c-1" }
    }
  }
};

export const WithError: Story = {
  args: { error: "Parámetros inválidos o faltantes: collectorId." }
};

export const Submitting: Story = {
  args: { submitting: true }
};
