/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Starting a renewal from the copilot (openspec add-loan-renewal): from a loan
 * search result, "Renovar" asks the copilot, whose renewal card starts the
 * renewal against the real server and opens the renewal panel. There is no LLM
 * in e2e, so only the copilotChat round-trip is stubbed — to the exact reply
 * the model produces when it calls openRenewalForm. Seeded by seed-e2e.mjs
 * ("Rosa Renovación": 10 × RD$1,300 weekly, 8 paid, so RD$2,600 still owed).
 */
import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("an admin starts a renewal from the copilot and the panel opens on it", async ({ page }) => {
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
              reply: "Listo. Abrí la renovación desde la tarjeta para revisar los términos.",
              renewalForm: { loanId }
            }
          }
        }
      ])
    })
  );

  await renovar.click();
  await page.getByRole("button", { name: "Enviar", exact: true }).click();

  // The card starts the renewal: a DRAFT that has written nothing else.
  await page.getByTestId("renewal-card-start").click();
  const panel = page.getByTestId("renewal-panel");
  await expect(panel).toBeVisible();
  await expect(panel.getByTestId("renewal-status")).toHaveAttribute("data-status", "DRAFT");
  await expect(panel.getByTestId("renewal-owed")).toHaveText("RD$2,600");
  await expect(panel.getByTestId("renewal-principal")).toHaveText("RD$10,000");
  await expect(panel.getByTestId("renewal-net")).toHaveText("RD$7,400");

  // Asking again picks up the same renewal instead of starting a second one.
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
  await page.getByTestId("renewal-card-open").click();
  await expect(panel).toBeVisible();
  await expect(panel.getByTestId("renewal-status")).toHaveAttribute("data-status", "DRAFT");
});
