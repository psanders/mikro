/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * The loan calculator opens from the feed header for admins and reviewers
 * alike; the copilot stays admin-only.
 */
import { expect, test, type Page } from "@playwright/test";
import { login } from "./helpers";

async function checkWeeklyExample(page: Page) {
  await page.getByRole("button", { name: "Calculadora" }).click();
  const panel = page.getByTestId("calculator-panel");
  await expect(panel).toBeVisible();

  // Opens with nothing to show and no error yet.
  await expect(panel.getByTestId("calc-empty")).toBeVisible();
  await expect(panel.getByTestId("calc-error")).toHaveCount(0);

  await panel.getByTestId("calc-principal").fill("10000");
  await panel.getByTestId("calc-duration").fill("10");
  await expect(panel.getByTestId("calc-options").locator("tbody tr")).toHaveCount(7);
  const base = panel.getByTestId("calc-option-base");
  await expect(base).toContainText("10 sem.");
  await expect(base).toContainText("RD$ 3,000");
  await expect(base).toContainText("RD$ 13,000");
  await expect(base).toContainText("RD$ 1,300");

  // Clearing the monto swaps the table for an inline message.
  await panel.getByTestId("calc-principal").fill("");
  await expect(panel.getByTestId("calc-error")).toHaveText("Ingresa un monto mayor que cero.");
  await expect(panel.getByTestId("calc-options")).toHaveCount(0);

  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
}

test("a reviewer runs the calculator without getting the copilot", async ({ page }) => {
  await login(page, "ana");
  await expect(page.getByRole("button", { name: "Copiloto" })).toHaveCount(0);
  await checkWeeklyExample(page);
});

test("an admin runs the calculator next to the copilot", async ({ page }) => {
  await login(page, "admin");
  await expect(page.getByRole("button", { name: "Copiloto" })).toBeVisible();
  await checkWeeklyExample(page);
});
