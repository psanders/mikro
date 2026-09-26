/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * The application panel shows the applicant's persisted WhatsApp conversation
 * (#299): the person on the left, agents and Mikro's fixed replies on the
 * right, and a marker where the conversation passed to a person.
 */
import { expect, test } from "@playwright/test";
import { card, expand, login, openQueue } from "./helpers";

test("a reviewer reads the applicant's WhatsApp conversation in the full application", async ({
  page
}) => {
  await login(page, "ana");
  await expect(page.getByTestId("queue-group")).toBeVisible();
  await openQueue(page);

  const colmado = card(page, "Colmado Cola");
  await expand(colmado);
  await colmado.getByTestId("action-view-full").click();

  const thread = page.getByTestId("application-conversation");
  await expect(thread).toBeVisible();
  const turns = thread.getByTestId("conversation-turn");
  await expect(turns).toHaveCount(6);

  // Oldest first, from before the application existed.
  await expect(turns.first()).toHaveAttribute("data-role", "INBOUND");
  await expect(turns.first()).toContainText("Yokasta");
  await expect(turns.first()).toContainText("¿qué necesito para un préstamo?");
  await expect(turns.nth(1)).toContainText("Lucía (agente)");
  await expect(turns.nth(3)).toContainText("José (agente)");
  await expect(turns.nth(5)).toHaveAttribute("data-role", "SYSTEM");
  await expect(turns.nth(5)).toContainText("Mikro (automático)");

  const handoff = thread.getByTestId("conversation-handoff");
  await expect(handoff).toContainText("Pasó a una persona · Pidió hablar con una persona");

  // Chatwoot is not configured for the e2e backend: no dead link.
  await expect(thread.getByRole("link", { name: /Chatwoot/ })).toHaveCount(0);
});
