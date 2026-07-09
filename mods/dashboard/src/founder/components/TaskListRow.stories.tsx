/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { Meta, StoryObj } from "@storybook/react-vite";
import { TaskListRow } from "./TaskListRow";
import type { TaskListItem } from "./TaskListRow";

function inDays(days: number, hour: number): string {
  const d = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

const paymentTask: TaskListItem = {
  id: "task-1",
  name: "Pago semanal Ana",
  automationId: "payment",
  automationTitle: "Pago",
  frequency: "weekly",
  weekday: 5,
  dayOfMonth: null,
  onDate: null,
  timeOfDay: "08:00",
  enabled: true,
  nextFireAt: inDays(4, 8),
  askLabels: ["Monto (RD$)"]
};

const dailyCloseTask: TaskListItem = {
  id: "task-2",
  name: "Cierre contable del día",
  automationId: "daily-close",
  automationTitle: "Cierre contable del día",
  frequency: "daily",
  weekday: null,
  dayOfMonth: null,
  onDate: null,
  timeOfDay: "07:00",
  enabled: true,
  nextFireAt: inDays(1, 7),
  askLabels: []
};

const pausedExpenseTask: TaskListItem = {
  id: "task-3",
  name: "Gasolina de la semana",
  automationId: "record-expense",
  automationTitle: "Registrar gasto",
  frequency: "weekly",
  weekday: 6,
  dayOfMonth: null,
  onDate: null,
  timeOfDay: "09:00",
  enabled: false,
  nextFireAt: null,
  askLabels: ["Monto (RD$)"]
};

const meta = {
  title: "Components/Tareas/TaskListRow",
  component: TaskListRow,
  parameters: { layout: "padded" },
  args: { onToggle: () => {}, onEdit: () => {}, onDelete: () => {} },
  decorators: [
    (Story) => (
      <div style={{ width: 900 }}>
        <Story />
      </div>
    )
  ]
} satisfies Meta<typeof TaskListRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PayCollectorWeekly: Story = {
  args: { task: paymentTask }
};

export const DailyClose: Story = {
  args: { task: dailyCloseTask }
};

export const PausedExpense: Story = {
  name: "Paused — toggle off, no next firing",
  args: { task: pausedExpenseTask }
};

export const List: Story = {
  args: { task: paymentTask },
  render: () => (
    <div style={{ width: 900 }}>
      <TaskListRow task={paymentTask} onToggle={() => {}} />
      <TaskListRow task={dailyCloseTask} onToggle={() => {}} />
      <TaskListRow task={pausedExpenseTask} onToggle={() => {}} />
    </div>
  )
};
