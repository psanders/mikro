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

  // Opens with nothing to show and no error yet; the rate comes from the server.
  await expect(panel.getByTestId("calc-empty")).toBeVisible();
  await expect(panel.getByTestId("calc-error")).toHaveCount(0);
  await expect(panel.getByTestId("calc-rate")).toHaveCount(0);
  await panel.getByTestId("calc-principal").focus();
  await page.keyboard.press("Tab");
  await expect(panel.getByTestId("calc-frequency")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(panel.getByTestId("calc-duration")).toBeFocused();
  await expect(panel.getByTestId("calc-reference")).toHaveText(
    "30% a 10 semanas · ±1.5% por semana"
  );

  await panel.getByTestId("calc-principal").fill("10000");
  await panel.getByTestId("calc-duration").fill("10");
  await expect(panel.getByTestId("calc-options").locator("tbody tr")).toHaveCount(7);
  const base = panel.getByTestId("calc-option-base");
  await expect(base).toContainText("10 sem.");
  await expect(base).toContainText("RD$ 3,000");
  await expect(base).toContainText("RD$ 13,000");
  await expect(base).toContainText("RD$ 1,300");
  await expect(panel.getByTestId("calc-footnote")).toHaveText(
    "La tasa sube o baja 1.5% por cada semana de diferencia con 10 semanas, entre 10% y 60%. La cuota se redondea hacia arriba a RD$ 50."
  );

  // Centered at 9: same price for 10 weeks, it just isn't the base row.
  await panel.getByTestId("calc-duration").fill("9");
  await expect(base).toContainText("9 sem.");
  await expect(base).toContainText("28.5%");
  await expect(base).toContainText("RD$ 1,450");
  const ten = panel.getByTestId("calc-option").filter({ hasText: "10 sem." });
  await expect(ten).toContainText("30%");
  await expect(ten).toContainText("RD$ 1,300");

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

test("the calculator shows no prices while pricing loads or when it fails", async ({ page }) => {
  await login(page, "admin");
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route("**/trpc/*getLoanPricing*", async (route) => {
    await held;
    await route.abort();
  });
  await page.getByRole("button", { name: "Calculadora" }).click();
  const panel = page.getByTestId("calculator-panel");

  await panel.getByTestId("calc-principal").fill("10000");
  await panel.getByTestId("calc-duration").fill("10");
  await expect(panel.getByTestId("calc-reference")).toHaveText("Cargando…");
  await expect(panel.getByTestId("calc-loading")).toHaveText("Cargando tasa de referencia…");
  await expect(panel.getByTestId("calc-options")).toHaveCount(0);

  release();
  // React Query retries before giving up.
  const retry = panel.getByRole("button", { name: "Reintentar" });
  await expect(retry).toBeVisible({ timeout: 20_000 });
  await expect(panel.getByTestId("calc-reference")).toHaveText("No disponible");
  await expect(panel.getByTestId("calc-options")).toHaveCount(0);
  await expect(panel.getByTestId("calc-footnote")).toHaveCount(0);

  // Inputs stay editable; once the server answers, Reintentar brings the options.
  await panel.getByTestId("calc-duration").fill("9");
  await page.unroute("**/trpc/*getLoanPricing*");
  await retry.click();
  await expect(panel.getByTestId("calc-option-base")).toContainText("RD$ 1,450");
});
