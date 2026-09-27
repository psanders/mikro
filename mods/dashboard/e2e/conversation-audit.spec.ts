/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Conversation audit card (openspec add-conversation-audit): the seeded run
 * found José's failed send to Yokasta. The card only states the verdict; the
 * admin opens the findings panel from it and jumps to the conversation.
 */
import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("the admin reads the audit verdict and jumps to the flagged conversation", async ({
  page
}) => {
  await login(page, "admin");

  const auditCard = page.getByTestId("audit-card");
  await expect(auditCard).toHaveCount(1);
  await expect(auditCard).toContainText("Auditoría de conversaciones la conversación no cumple");
  await expect(auditCard).toContainText("1 advertencia · automática");

  await auditCard.locator("[aria-expanded]").first().click();
  await expect(auditCard).toContainText(
    "La conversación revisada no cumple. Lo más grave (José): Mensaje no entregado."
  );
  // The card only states the verdict: no metadata / insights links.
  await expect(auditCard.getByRole("button", { name: "Metadata" })).toHaveCount(0);

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
