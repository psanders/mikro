/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Shared steps for the Ops app specs. Users and applications come from
 * mods/apiserver/scripts/seed-e2e.mjs.
 */
import { expect, type Locator, type Page } from "@playwright/test";

export const USERS = {
  admin: { phone: "8292000001", name: "Pedro Admin" },
  ana: { phone: "8292000002", name: "Ana Evaluadora" },
  luis: { phone: "8292000003", name: "Luis Evaluador" },
  miguel: { phone: "8292000004", name: "Miguel Cobrador" }
} as const;

export const PASSWORD = "e2e-pass";

/** A 1×1 PNG, enough for the cédula slots and business photos. */
export const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64"
);

export async function login(page: Page, who: keyof typeof USERS) {
  await page.goto("/login");
  await page.getByLabel("Teléfono").fill(USERS[who].phone);
  await page.getByLabel("Contraseña").fill(PASSWORD);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page).toHaveURL(/\/ops/);
}

/** The feed card of the application whose line mentions `text` (business or person). */
export function card(page: Page, text: string): Locator {
  return page.getByTestId("application-card").filter({ hasText: text });
}

/** Expand a card (idempotent). */
export async function expand(cardLocator: Locator) {
  const header = cardLocator.locator("button[aria-expanded]").first();
  if ((await header.getAttribute("aria-expanded")) !== "true") await header.click();
}

/**
 * Open the group rows that fold application cards: the day's queue (2+ new
 * applications) and the pinned "Otras N solicitudes abiertas" row.
 */
export async function openQueue(page: Page) {
  for (const id of ["open-group", "queue-group"]) {
    const group = page.getByTestId(id);
    if (await group.count()) {
      const header = group.locator("button[aria-expanded]").first();
      if ((await header.getAttribute("aria-expanded")) !== "true") await header.click();
    }
  }
}
