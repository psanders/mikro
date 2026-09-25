/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * The Tareas form opens in the side panel (the Ops app has no modals), and old
 * /founder links redirect to /ops.
 */
import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("the task form opens in the side panel and closes with Escape", async ({ page }) => {
  await login(page, "admin");
  await page.goto("/founder/tareas");
  await expect(page).toHaveURL(/\/ops$/);
  await page.getByRole("button", { name: "Tareas" }).click();
  await page.getByRole("button", { name: /Nueva tarea/ }).click();
  const panel = page.getByTestId("task-panel");
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("heading", { name: "Nueva tarea" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
});
