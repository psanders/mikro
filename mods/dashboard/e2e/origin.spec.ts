/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Every application shows where it came from (add-application-origin): a chip
 * on the feed card, and an "Origen" row at the top of the full application.
 */
import { expect, test } from "@playwright/test";
import { card, expand, login } from "./helpers";

test("the feed card and the full application show the application's origin", async ({ page }) => {
  await login(page, "admin");

  const salon = card(page, "Salón Pendiente");
  await expect(salon.getByTestId("origin-chip")).toHaveAttribute("data-origin", "ad");
  await expect(salon.getByTestId("origin-chip")).toHaveText("Formulario (anuncio)");
  await expect(card(page, "Taller Pendiente").getByTestId("origin-chip")).toHaveText(
    "Formulario (orgánico)"
  );

  await expand(salon);
  await salon.getByTestId("action-view-full").click();
  await expect(page.getByTestId("app-origin")).toContainText("Formulario (anuncio)");
});
