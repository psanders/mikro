/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Loan renewal golden path (openspec add-loan-renewal): from a loan search
 * result, "Renovar" opens the copilot's renewal card, which loads the real
 * payoff quote and renews against the real server. There is no LLM in e2e, so
 * only the copilotChat round-trip is stubbed — to the exact reply the model
 * produces when it calls openRenewalForm. Seeded by seed-e2e.mjs ("Rosa
 * Renovación": 10 × RD$1,300 weekly, 8 paid).
 */
import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("an admin renews a loan from search and sees it in the feed", async ({ page }) => {
  await login(page, "admin");

  await page.goto("/ops/buscar");
  await page.getByPlaceholder("Buscar clientes, préstamos y actividad…").fill("Rosa Renovación");
  const renovar = page.getByRole("button", { name: "Renovar", exact: true });
  await expect(renovar).toBeVisible();

  // Which loan number the row carries (sequential, assigned by the seed).
  const rowText = await page.getByText(/#\d+ — Rosa Renovación/).textContent();
  const loanId = Number(rowText!.match(/#(\d+)/)![1]);

  await page.route("**/trpc/copilotChat?batch=1", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify([
        {
          result: {
            data: {
              reply: "Listo. Revisá el saldo pendiente y los términos nuevos para renovar.",
              renewalForm: { loanId }
            }
          }
        }
      ])
    })
  );

  await renovar.click();
  await page.getByRole("button", { name: "Enviar", exact: true }).click();

  // The card loads the real quote: 2 cuotas × RD$1,300 still owed.
  await expect(page.getByText("Saldo pendiente", { exact: true })).toBeVisible();
  await expect(page.getByText("RD$2,600").first()).toBeVisible();
  await expect(page.getByText("A desembolsar", { exact: true })).toBeVisible();

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Renovar préstamo" }).click();
  await expect(page.getByRole("button", { name: "Préstamo renovado" })).toBeVisible();
  expect((await download).suggestedFilename()).toMatch(/^contrato-.*\.pdf$/);

  // The renewal lands in the feed, naming both loans.
  await page.goto("/ops");
  await expect(page.getByText(new RegExp(`renovó el préstamo #${loanId} → #\\d+`))).toBeVisible();
});
