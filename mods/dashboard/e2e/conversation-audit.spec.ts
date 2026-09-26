/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Conversation audit card (openspec add-conversation-audit): the seeded run
 * found one problem (José's failed send to Yokasta). The admin expands the
 * card, opens the findings panel, and jumps to the conversation.
 */
import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("the admin reviews an audit run and jumps to the flagged conversation", async ({ page }) => {
  await login(page, "admin");

  const auditCard = page.getByTestId("audit-card");
  await expect(auditCard).toHaveCount(1);
  await expect(auditCard).toContainText("Auditoría de conversaciones");
  await expect(auditCard).toContainText("encontró 1 problema en 1 conversación");
  await expect(auditCard).toContainText("1 advertencia · automática");

  await auditCard.locator("[aria-expanded]").first().click();
  await expect(auditCard.getByTestId("audit-stat-conversaciones")).toHaveText("1");
  await expect(auditCard.getByTestId("audit-stat-no-entregado")).toHaveText("1");
  await expect(auditCard.getByTestId("audit-agent-row")).toContainText(["José"]);
  const top = auditCard.getByTestId("audit-top-finding");
  await expect(top).toContainText("Mensaje no entregado");
  await expect(top).toContainText("Yokasta");

  await auditCard.getByTestId("audit-open-detail").click();
  const panel = page.getByTestId("audit-panel");
  await expect(panel).toBeVisible();
  const findings = panel.getByTestId("audit-finding");
  await expect(findings).toHaveCount(1);
  await expect(findings.first()).toHaveAttribute("data-severity", "WARNING");
  await expect(findings.first()).toContainText("Chequeo fijo");
  await expect(findings.first()).toContainText("NO ENTREGADO");

  await findings.first().getByTestId("audit-finding-open-conversation").click();
  await expect(panel).toHaveCount(0);
  await expect(page.getByTestId("application-conversation")).toBeVisible();
});
