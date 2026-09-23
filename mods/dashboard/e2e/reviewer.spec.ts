/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Reviewer journey (Ana): the shared queue → take → evidence (fixed cédula
 * slots + 3 business photos) → recommendation → send to decision. Plus role
 * scoping: another reviewer's application is not in Ana's feed, and the admin
 * tools are not in her rail.
 */
import { expect, test } from "@playwright/test";
import { card, expand, login, openQueue, PNG } from "./helpers";

test("a reviewer takes a queued application, gathers the evidence and sends it to decision", async ({
  page
}) => {
  await login(page, "ana");

  // Scoped shell: feed only.
  await expect(page.getByRole("button", { name: "Búsqueda" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Reportes" })).toHaveCount(0);

  // Luis's application is invisible to Ana; the shared queue is visible.
  await expect(page.getByText("Tienda de Luis")).toHaveCount(0);
  await openQueue(page);
  const colmado = card(page, "Colmado Cola");
  await expect(colmado).toHaveAttribute("data-status", "RECEIVED");

  // RECEIVED offers only "Tomar".
  await expand(colmado);
  await expect(colmado.getByTestId("action-evidence")).toHaveCount(0);
  await colmado.getByTestId("action-take").click();
  await expect(card(page, "Colmado Cola")).toHaveAttribute("data-status", "IN_REVIEW");

  // The card stays open on the next step: gathering evidence.
  const mine = card(page, "Colmado Cola");
  await expect(mine.getByTestId("action-evidence")).toBeVisible();
  await expect(mine.getByTestId("action-send")).toBeDisabled();

  // Evidence in the side panel: both cédula slots, three photos.
  await mine.getByTestId("action-evidence").click();
  const panel = page.getByTestId("application-panel");
  await expect(panel.getByTestId("evidence-view")).toBeVisible();
  await expect(panel.getByTestId("evidence-pending")).toContainText("Falta");
  const png = (name: string) => ({ name, mimeType: "image/png", buffer: PNG });
  await panel.getByTestId("evidence-slot-front-input").setInputFiles(png("frente.png"));
  await panel.getByTestId("evidence-slot-back-input").setInputFiles(png("reverso.png"));
  await panel
    .getByTestId("evidence-photos-input")
    .setInputFiles([png("fachada.png"), png("interior.png"), png("mercancia.png")]);
  await expect(panel.getByTestId("evidence-pending")).toHaveText(/Evidencia completa/);
  await panel.getByRole("button", { name: "Listo" }).click();
  await page.getByTestId("application-panel-close").click();

  // Recommendation, then send.
  await mine.getByTestId("recommendation-input").fill("Aprobar RD$10,000 a 10 semanas");
  await mine.getByTestId("recommendation-save").click();
  await expect(mine.getByTestId("action-send")).toBeEnabled();
  await mine.getByTestId("action-send").click();
  await expect(card(page, "Colmado Cola")).toHaveAttribute("data-status", "PENDING_DECISION");
});
