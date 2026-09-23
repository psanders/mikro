/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Conversion: an approved application with its signed contract is disbursed
 * from a configured account (not the default) to a collector, and leaves the
 * active feed for the day's "Cerradas" group.
 */
import { expect, test } from "@playwright/test";
import { card, expand, login } from "./helpers";

test("the reviewer disburses an approved application and it moves to Cerradas", async ({
  page
}) => {
  await login(page, "ana");

  const ferreteria = card(page, "Ferretería Aprobada");
  await expect(ferreteria).toHaveAttribute("data-status", "APPROVED");
  await expand(ferreteria);
  await ferreteria.getByTestId("action-disburse").click();

  const panel = page.getByTestId("application-panel");
  await expect(panel.getByTestId("disburse-view")).toBeVisible();
  // Only the accounts configured in mikro.json, default preselected.
  const caja = panel.getByTestId("disburse-account-eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1");
  const recaudo = panel.getByTestId("disburse-account-eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2");
  await expect(caja).toContainText("Caja General");
  await expect(caja).toContainText("Predeterminada");
  await expect(recaudo).toContainText("Cuenta de Recaudación");
  await expect(panel.locator('[data-testid^="disburse-account-"]')).toHaveCount(2);
  const confirm = panel.getByTestId("disburse-confirm");
  await expect(confirm).toBeDisabled(); // no collector yet
  await panel.getByTestId("disburse-collector").selectOption({ label: "Miguel Cobrador" });
  await recaudo.click();
  await expect(panel).toContainText("en Cuenta de Recaudación");
  await confirm.click();

  await expect(page.getByTestId("application-panel")).toHaveCount(0);
  await expect(card(page, "Ferretería Aprobada")).toHaveCount(0);
  const closed = page.getByTestId("closed-group");
  await expect(closed).toBeVisible();
  await closed.locator("button[aria-expanded]").first().click();
  const item = closed.getByTestId("closed-item").filter({ hasText: "Ferretería Aprobada" });
  await expect(item.getByTestId("status-pill")).toHaveText("Convertida");
});
