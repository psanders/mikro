/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * A contract signed before the review flow (a migrated SIGNED application)
 * stored no terms and, from an old form, no amount. The disbursement panel asks
 * for them — copied from the signed paper — instead of blocking the loan.
 */
import { expect, test } from "@playwright/test";
import { card, expand, login } from "./helpers";

test("a pre-flow signed contract is disbursed with the terms typed from it", async ({ page }) => {
  await login(page, "ana");

  const old = card(page, "Contrato Antiguo");
  await expect(old).toHaveAttribute("data-status", "APPROVED");
  await expand(old);
  await old.getByTestId("action-disburse").click();

  const panel = page.getByTestId("application-panel");
  await expect(panel.getByTestId("disburse-legacy-terms")).toBeVisible();
  const confirm = panel.getByTestId("disburse-confirm");
  await panel.getByTestId("disburse-collector").selectOption({ label: "Miguel Cobrador" });
  await expect(confirm).toBeDisabled(); // no amount or terms yet

  await panel.getByTestId("disburse-legacy-principal").fill("8000");
  await panel.getByTestId("disburse-legacy-installments").fill("10");
  await panel.getByTestId("disburse-legacy-installment-amount").fill("1000");
  await expect(panel).toContainText("retiro de RD$8,000");
  await confirm.click();

  await expect(page.getByTestId("application-panel")).toHaveCount(0);
  await expect(card(page, "Contrato Antiguo")).toHaveCount(0);
});
