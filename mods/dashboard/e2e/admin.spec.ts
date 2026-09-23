/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Admin decisions, inline on the card: approve with adjusted terms, and send
 * one back to its reviewer with a note (which is required).
 */
import { expect, test } from "@playwright/test";
import { card, expand, login } from "./helpers";

test("the admin approves with adjusted terms and returns another with a note", async ({ page }) => {
  await login(page, "admin");

  const salon = card(page, "Salón Pendiente");
  await expect(salon).toHaveAttribute("data-status", "PENDING_DECISION");
  await expand(salon);
  const decision = salon.getByTestId("decision-block");
  await decision.getByTestId("decision-amount").fill("10000");
  await decision.getByTestId("decision-weeks").fill("10");
  await decision.getByTestId("decision-approve").click();
  await expect(card(page, "Salón Pendiente")).toHaveAttribute("data-status", "APPROVED");

  const taller = card(page, "Taller Pendiente");
  await expand(taller);
  const back = taller.getByTestId("decision-return");
  await expect(back).toBeDisabled();
  await taller.getByTestId("decision-note").fill("Falta una foto de la mercancía");
  await back.click();
  await expect(card(page, "Taller Pendiente")).toHaveAttribute("data-status", "IN_REVIEW");
});
