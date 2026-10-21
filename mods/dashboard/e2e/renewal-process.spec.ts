/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * The renewal as a process, driven by REVIEWERS through the real UI against the
 * real server (openspec add-loan-renewal): search → customer profile → renew →
 * terms → contract → signed copy → finalize, plus cancel, past applications in
 * search, and the profile's edit and documents. Seeded by seed-e2e.mjs: Pablo,
 * Lucía and Rosa Renovación each have an ACTIVE loan of 10 × RD$1,300 weekly
 * with 8 paid (RD$2,600 owed).
 */
import { expect, test, type Browser, type Page } from "@playwright/test";
import { login, PNG } from "./helpers";

const SEARCH = "Buscar clientes, préstamos y actividad…";

async function search(page: Page, query: string) {
  await page.goto("/ops/buscar");
  await page.getByPlaceholder(SEARCH).fill(query);
}

/**
 * Register a RD$1,300 cuota on a loan as the admin, in a second browser context:
 * the reviewer's page never sees it happen. createPayment is collector/admin only.
 */
async function payCuotaBehindTheirBack(browser: Browser, loanNumber: number) {
  const context = await browser.newContext({ baseURL: "http://localhost:5199" });
  try {
    const admin = await context.newPage();
    await login(admin, "admin");
    const status = await admin.evaluate(async (loanId) => {
      const call = async (path: string, init?: RequestInit) =>
        fetch(`http://localhost:4199/trpc/${path}`, {
          ...init,
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${localStorage.getItem("mikro_jwt")}`
          }
        });
      const me = await (await call("whoami")).json();
      const res = await call("createPayment", {
        method: "POST",
        body: JSON.stringify({
          loanId,
          amount: 1300,
          method: "CASH",
          collectedById: me.result.data.id
        })
      });
      return res.status;
    }, loanNumber);
    expect(status).toBe(200);
  } finally {
    await context.close();
  }
}

/** Search a customer, open the profile and start (or continue) the renewal of their loan. */
async function startRenewalFromProfile(page: Page, name: string) {
  await search(page, name);
  await page.getByRole("button", { name: "Ver perfil" }).first().click();
  await expect(page.getByTestId("customer-panel")).toBeVisible();
  await page.getByTestId("customer-tab-prestamos").click();
  await page.getByTestId("customer-renew").click();
  const panel = page.getByTestId("renewal-panel");
  await expect(panel).toBeVisible();
  return panel;
}

test("search finds past applications by name, phone and cédula, never a draft or abandoned one", async ({
  page
}) => {
  await login(page, "ana");

  await search(page, "pablo ren");
  await expect(page.getByTestId("search-application")).toHaveCount(1);
  await expect(page.getByText("Convertida")).toBeVisible();

  // Accents and case do not matter; a cédula works with or without dashes.
  await page.getByPlaceholder(SEARCH).fill("001-0000051-1");
  await expect(page.getByTestId("search-application")).toHaveCount(1);
  await page.getByPlaceholder(SEARCH).fill("00100000511");
  await expect(page.getByTestId("search-application")).toHaveCount(1);
  await page.getByPlaceholder(SEARCH).fill("829 200 0051");
  await expect(page.getByTestId("search-application")).toHaveCount(1);

  // The draft ("Pablo Borrador") and the abandoned ("Pablo Abandonado") never show.
  await page.getByPlaceholder(SEARCH).fill("Pablo");
  await expect(page.getByTestId("search-application")).toHaveCount(1);
  await expect(page.getByText("Borrador", { exact: false }).first()).not.toBeVisible();
  await expect(page.getByText("Pablo Abandonado")).toHaveCount(0);

  // Clicking it opens the application panel.
  await page.getByRole("button", { name: "Ver solicitud" }).click();
  await expect(page.getByTestId("application-panel")).toBeVisible();
});

test("a reviewer renews a loan from the customer profile, start to finish", async ({ page }) => {
  await login(page, "ana");
  const panel = await startRenewalFromProfile(page, "Pablo Renovación");

  // DRAFT: owed 2,600 on the old loan, 10,000 new, 7,400 leaves the account.
  await expect(panel.getByTestId("renewal-status")).toHaveAttribute("data-status", "DRAFT");
  await expect(panel.getByTestId("renewal-owed")).toHaveText("RD$2,600");
  await expect(panel.getByTestId("renewal-net")).toHaveText("RD$7,400");

  // Terms: a bigger loan changes the net, not what is owed.
  await panel.getByTestId("renewal-principal").fill("12000");
  await expect(panel.getByTestId("renewal-net")).toHaveText("RD$9,400");
  await panel.getByTestId("renewal-save-terms").click();
  await expect(panel.getByTestId("renewal-net")).toHaveText("RD$9,400");

  // A loan that does not cover what is owed cannot be saved.
  await panel.getByTestId("renewal-principal").fill("2000");
  await expect(panel.getByTestId("renewal-net-error")).toBeVisible();
  await expect(panel.getByTestId("renewal-save-terms")).toBeDisabled();
  await panel.getByTestId("renewal-principal").fill("12000");

  // Contract, from the stored terms.
  await panel.getByTestId("renewal-tab-contrato").click();
  await panel.getByTestId("renewal-generate-contract").click();
  await expect(panel.getByTestId("renewal-contract-card")).toBeVisible();
  await expect(panel.getByTestId("renewal-status")).toHaveAttribute(
    "data-status",
    "CONTRACT_READY"
  );

  // The signed copy makes it ready to finalize.
  await panel.getByTestId("renewal-signed-upload-input").setInputFiles({
    name: "contrato-firmado.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4 signed by the customer")
  });
  await expect(panel.getByTestId("renewal-signed-card")).toBeVisible();
  await expect(panel.getByTestId("renewal-status")).toHaveAttribute("data-status", "SIGNED");

  // Finalize: confirm the exact amount that leaves the account.
  await panel.getByTestId("renewal-tab-finalizar").click();
  await expect(panel.getByTestId("renewal-net")).toHaveText("RD$9,400");
  await expect(panel.getByTestId("renewal-finalize-button")).toBeDisabled();
  await panel.getByTestId("renewal-confirm").check();
  await panel.getByTestId("renewal-finalize-button").click();
  await expect(panel.getByTestId("renewal-done")).toBeVisible();
  await expect(panel.getByTestId("renewal-status")).toHaveAttribute("data-status", "COMPLETED");

  // The feed has one card for the renewal, in its final state.
  await page.keyboard.press("Escape");
  await page.goto("/ops");
  const card = page.getByTestId("renewal-card").filter({ hasText: "Pablo Renovación" });
  await expect(card).toHaveCount(1);
  await expect(card).toHaveAttribute("data-status", "COMPLETED");
  await expect(card.getByTestId("renewal-card-sentence")).toContainText("renovado");
  await expect(card.getByTestId("renewal-card-sentence")).toContainText("RD$9,400");
});

test("when a cuota is paid after the reviewer confirmed, finalize writes nothing and asks to confirm the new amount", async ({
  page,
  browser
}) => {
  await login(page, "ana");
  const panel = await startRenewalFromProfile(page, "Nora Renovación");
  await expect(panel.getByTestId("renewal-net")).toHaveText("RD$7,400");

  await panel.getByTestId("renewal-tab-contrato").click();
  await panel.getByTestId("renewal-generate-contract").click();
  await expect(panel.getByTestId("renewal-contract-card")).toBeVisible();
  await panel.getByTestId("renewal-signed-upload-input").setInputFiles({
    name: "contrato-firmado.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4 signed by the customer")
  });
  await expect(panel.getByTestId("renewal-signed-card")).toBeVisible();
  await expect(panel.getByTestId("renewal-status")).toHaveAttribute("data-status", "SIGNED");

  // The reviewer looks at RD$7,400 and confirms it.
  await panel.getByTestId("renewal-tab-finalizar").click();
  await expect(panel.getByTestId("renewal-net")).toHaveText("RD$7,400");
  await panel.getByTestId("renewal-confirm").check();
  await expect(panel.getByTestId("renewal-finalize-button")).toBeEnabled();

  // Meanwhile the customer pays a cuota: owed drops to RD$1,300, the net grows to RD$8,700.
  const loanNumber = Number(
    (await panel.getByTestId("renewal-finalize").textContent())?.match(/préstamo #(\d+) pasa/)?.[1]
  );
  expect(loanNumber).toBeGreaterThan(0);
  await payCuotaBehindTheirBack(browser, loanNumber);

  // The server refuses the stale amount; the panel withdraws the confirmation and says why.
  await panel.getByTestId("renewal-finalize-button").click();
  await expect(panel.getByTestId("renewal-net-changed")).toBeVisible();
  await expect(panel.getByTestId("renewal-net-changed")).toContainText("RD$8,700");
  await expect(panel.getByTestId("renewal-status")).toHaveAttribute("data-status", "SIGNED");
  await expect(panel.getByTestId("renewal-confirm")).not.toBeChecked();
  await expect(panel.getByTestId("renewal-finalize-button")).toBeDisabled();
  await expect(panel.getByTestId("renewal-net")).toHaveText("RD$8,700");

  // Confirming the new amount lets it through, for exactly that amount.
  await panel.getByTestId("renewal-confirm").check();
  await expect(panel.getByText("Confirmo que desembolsaré RD$8,700")).toBeVisible();
  await expect(panel.getByTestId("renewal-finalize-button")).toBeEnabled();
  await panel.getByTestId("renewal-finalize-button").click();
  await expect(panel.getByTestId("renewal-done")).toBeVisible();
  await expect(panel.getByTestId("renewal-status")).toHaveAttribute("data-status", "COMPLETED");
  await expect(panel.getByTestId("renewal-done")).toContainText("RD$8,700");
});

test("a reviewer cancels a renewal at any point; the loan stays active and can be renewed again", async ({
  page
}) => {
  await login(page, "luis");
  const panel = await startRenewalFromProfile(page, "Lucía Renovación");
  await panel.getByTestId("renewal-tab-contrato").click();
  await panel.getByTestId("renewal-generate-contract").click();
  await expect(panel.getByTestId("renewal-status")).toHaveAttribute(
    "data-status",
    "CONTRACT_READY"
  );

  await panel.getByTestId("renewal-tab-terminos").click();
  await panel.getByTestId("renewal-cancel").click();
  await expect(page.getByTestId("renewal-cancel-dialog")).toBeVisible();
  await page.getByTestId("renewal-cancel-confirm").click();
  await expect(panel.getByTestId("renewal-status")).toHaveAttribute("data-status", "CANCELLED");

  // The feed card is the same card, now cancelled, offering another renewal.
  await page.keyboard.press("Escape");
  await page.goto("/ops");
  const card = page.getByTestId("renewal-card").filter({ hasText: "Lucía Renovación" });
  await expect(card).toHaveCount(1);
  await expect(card).toHaveAttribute("data-status", "CANCELLED");
  await card.getByTestId("renewal-action-another").click();
  await expect(page.getByTestId("renewal-panel").getByTestId("renewal-status")).toHaveAttribute(
    "data-status",
    "DRAFT"
  );
});

test("a reviewer edits a customer and uploads a document; only an admin can delete it", async ({
  page
}) => {
  await login(page, "ana");
  await search(page, "Rosa Renovación");
  await page.getByRole("button", { name: "Ver perfil" }).first().click();
  const profile = page.getByTestId("customer-panel");

  await profile.getByTestId("customer-homeAddress").fill("C/ Duarte #14, Los Mameyes");
  await profile.getByTestId("customer-save").click();
  await expect(page.getByText("Datos del cliente guardados.")).toBeVisible();

  // An invalid cédula is refused before it leaves the browser.
  await profile.getByTestId("customer-idNumber").fill("123");
  await profile.getByTestId("customer-save").click();
  await expect(profile.getByTestId("customer-error")).toContainText("000-0000000-0");

  await profile.getByTestId("customer-tab-documentos").click();
  await profile.getByTestId("customer-upload-input").setInputFiles({
    name: "cedula-frente.png",
    mimeType: "image/png",
    buffer: PNG
  });
  await expect(profile.getByTestId("customer-doc")).toHaveCount(1);
  await expect(profile.getByTestId("customer-doc-delete")).toHaveCount(0);

  // An admin sees the same document and can delete it.
  await page.context().clearCookies();
  await page.evaluate(() => localStorage.clear());
  await login(page, "admin");
  await search(page, "Rosa Renovación");
  await page.getByRole("button", { name: "Ver perfil" }).first().click();
  await page.getByTestId("customer-tab-documentos").click();
  await expect(page.getByTestId("customer-doc")).toHaveCount(1);
  await page.getByTestId("customer-doc-delete").click();
  await expect(page.getByTestId("customer-doc")).toHaveCount(0);
});
