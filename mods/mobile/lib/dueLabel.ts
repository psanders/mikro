/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Human label for a visit's next due date. Shared by the Hoy and Ruta tabs so
 * a customer due next week is never presented as due today.
 */
export function formatDueLabel(iso: string): string {
  const due = new Date(iso);
  const now = new Date();
  const todayStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const diffDays = Math.round((due.getTime() - todayStart.getTime()) / 86_400_000);
  if (diffDays <= 0) return "Hoy";
  if (diffDays === 1) return "Mañana";
  if (diffDays <= 6) {
    const day = due.toLocaleDateString("es-DO", { weekday: "long", timeZone: "UTC" });
    return day.charAt(0).toUpperCase() + day.slice(1);
  }
  // A week or more out: a weekday name would read as this week — show the date.
  return due.toLocaleDateString("es-DO", { day: "numeric", month: "short", timeZone: "UTC" });
}
