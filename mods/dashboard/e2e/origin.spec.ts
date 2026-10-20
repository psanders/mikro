/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * The full application shows where it came from (add-application-origin): an
 * "Origen" row at the top of its data. The feed card stays light — no origin.
 */
import { expect, test } from "@playwright/test";
import { card, expand, login } from "./helpers";

test("the full application shows its origin; the feed card does not", async ({ page }) => {
  await login(page, "admin");

  const salon = card(page, "Salón Pendiente");
  await expect(salon).toBeVisible();
  await expect(salon).not.toContainText("Formulario");

  await expand(salon);
  await salon.getByTestId("action-view-full").click();
  const origin = page.getByTestId("app-origin");
  await expect(origin).toBeVisible();
  await expect(origin).toContainText("Formulario (anuncio)");
});
