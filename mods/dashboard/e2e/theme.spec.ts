/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Dark mode (add-dark-mode): Sistema by default (follows the OS), Claro /
 * Oscuro from the avatar menu, remembered on this device.
 */
import { expect, test } from "@playwright/test";
import { login } from "./helpers";

const isDark = (page: import("@playwright/test").Page) =>
  page.evaluate(() => document.documentElement.classList.contains("dark"));

test("follows the OS by default and remembers a manual choice", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await login(page, "admin");
  expect(await isDark(page)).toBe(true); // Sistema → OS is dark

  await page.emulateMedia({ colorScheme: "light" });
  await expect.poll(() => isDark(page)).toBe(false); // follows the OS live

  await page.getByRole("button", { name: "Perfil" }).click();
  await expect(page.getByTestId("theme-system")).toHaveAttribute("aria-checked", "true");
  await page.getByTestId("theme-dark").click();
  expect(await isDark(page)).toBe(true);

  await page.reload();
  expect(await isDark(page)).toBe(true); // remembered, despite the light OS

  await page.getByRole("button", { name: "Perfil" }).click();
  await page.getByTestId("theme-system").click();
  expect(await isDark(page)).toBe(false);
});
