/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Open applications never hide behind the feed's default "Hoy" range: one
 * last touched on an earlier day shows in the pinned "Otras … abiertas" row,
 * and leaves it once today's activity puts it back in the day's stream.
 */
import { expect, test } from "@playwright/test";
import { card, expand, login, openQueue } from "./helpers";

test("an application received days ago stays visible until someone acts on it", async ({
  page
}) => {
  await login(page, "ana");

  // Collapsed, the row already names who is waiting.
  const group = page.getByTestId("open-group").filter({ hasText: "Marta Rosario" });
  await expect(group).toHaveCount(1);
  await openQueue(page);

  const viejo = card(page, "Colmado Viejo");
  await expect(viejo).toHaveAttribute("data-status", "RECEIVED");
  // Outside a day group, the card carries its day, not a bare clock time.
  await expect(viejo).toContainText(/\d{1,2} de [a-z]+/);
  await expand(viejo);
  await viejo.getByTestId("action-take").click();

  // Taken today: back at the head of today's stream, out of the pinned row.
  await expect(card(page, "Colmado Viejo")).toHaveAttribute("data-status", "IN_REVIEW");
  await expect(card(page, "Colmado Viejo")).toHaveCount(1);
  await expect(group).toHaveCount(0);
});
