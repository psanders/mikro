/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Starting a renewal (openspec add-loan-renewal): from a loan in search, or
 * from the copilot's card. Both start the renewal against the real server — a
 * DRAFT that writes nothing else — and open the renewal panel; asking again
 * finds the same renewal. Seeded by seed-e2e.mjs ("Rosa Renovación": 10 ×
 * RD$1,300 weekly, 8 paid, so RD$2,600 still owed). There is no LLM in e2e, so
 * only the copilotChat round-trip is stubbed — to the exact reply the model
 * produces when it calls openRenewalForm.
 */
import { expect, test, type Page } from "@playwright/test";
import { login } from "./helpers";

async function searchRosa(page: Page) {
  await page.goto("/ops/buscar");
  await page.getByPlaceholder("Buscar clientes, préstamos y actividad…").fill("Rosa Renovación");
  await expect(page.getByRole("button", { name: "Renovar", exact: true })).toBeVisible();
}

test("an admin renews from search: the panel opens on a DRAFT and Renovar finds it again", async ({
  page
}) => {
  await login(page, "admin");
  await searchRosa(page);

  await page.getByRole("button", { name: "Renovar", exact: true }).click();
  const panel = page.getByTestId("renewal-panel");
  await expect(panel).toBeVisible();
  await expect(panel.getByTestId("renewal-status")).toHaveAttribute("data-status", "DRAFT");
  await expect(panel.getByTestId("renewal-owed")).toHaveText("RD$2,600");
  await expect(panel.getByTestId("renewal-principal")).toHaveText("RD$10,000");
  await expect(panel.getByTestId("renewal-net")).toHaveText("RD$7,400");

  // Starting again picks up the same renewal instead of creating a second one.
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
  await page.getByRole("button", { name: "Renovar", exact: true }).click();
  await expect(panel).toBeVisible();
  await expect(panel.getByTestId("renewal-status")).toHaveAttribute("data-status", "DRAFT");
});

test("the copilot's renewal card starts a renewal and opens the panel", async ({ page }) => {
  await login(page, "admin");
  await searchRosa(page);
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

  await page.goto("/ops");
  await page.getByRole("button", { name: "Copiloto" }).click();
  await page.getByPlaceholder("Pregunta o pide una acción…").fill(`renueva el préstamo ${loanId}`);
  await page.getByRole("button", { name: "Enviar", exact: true }).click();

  await page.getByTestId("renewal-card-start").click();
  const panel = page.getByTestId("renewal-panel");
  await expect(panel).toBeVisible();
  await expect(panel.getByTestId("renewal-status")).toHaveAttribute("data-status", "DRAFT");
  await expect(panel.getByTestId("renewal-net")).toHaveText("RD$7,400");
});
