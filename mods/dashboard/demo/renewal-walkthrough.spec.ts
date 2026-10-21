/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * A narrated walkthrough of the whole renewal process, driven through the real
 * UI against the real (throwaway, seeded) server: a reviewer searches, opens a
 * customer, renews a loan, adjusts the terms, generates the contract, attaches
 * the signed copy, sees the amount change under her feet, finalizes, and then
 * cancels a second renewal. Everything on screen is real data — the ledger line
 * at the end is read back from the API.
 *
 *   npm run demo:renewal -w @mikro/dashboard
 */
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { PASSWORD, PNG } from "../e2e/helpers";
import { caption, card, hideCard, installOverlay } from "./overlay";

const API = "http://localhost:4199";
const PHONES = { admin: "8292000001", ana: "8292000002", luis: "8292000003" } as const;
const SEARCH = "Buscar clientes, préstamos y actividad…";

const beat = (page: Page, ms = 1600) => page.waitForTimeout(ms);

async function say(page: Page, text: string, ms = 2600) {
  await caption(page, text);
  await beat(page, ms);
}

/** Type like a person, not a script. */
async function typeInto(page: Page, locator: ReturnType<Page["locator"]>, text: string) {
  await locator.click();
  await locator.fill("");
  await locator.pressSequentially(text, { delay: 85 });
}

async function trpc<T>(
  request: APIRequestContext,
  token: string | null,
  kind: "query" | "mutation",
  proc: string,
  input: unknown
): Promise<T> {
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
  const res =
    kind === "mutation"
      ? await request.post(`${API}/trpc/${proc}`, { data: input, headers })
      : await request.get(
          `${API}/trpc/${proc}?input=${encodeURIComponent(JSON.stringify(input))}`,
          {
            headers
          }
        );
  const body = (await res.json()) as { result?: { data: T }; error?: { message: string } };
  if (!body.result) throw new Error(`${proc}: ${body.error?.message ?? res.status()}`);
  return body.result.data;
}

async function apiLogin(request: APIRequestContext, phone: string) {
  const out = await trpc<{ token: string }>(request, null, "mutation", "login", {
    phone: `+1${phone}`,
    password: PASSWORD
  });
  return out.token;
}

async function signIn(page: Page, who: keyof typeof PHONES, why: string) {
  await page.goto("/login");
  await say(page, why, 2800);
  await typeInto(page, page.getByLabel("Teléfono"), PHONES[who]);
  await typeInto(page, page.getByLabel("Contraseña"), PASSWORD);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page).toHaveURL(/\/ops/);
  await beat(page, 1200);
}

test("loan renewal, start to finish", async ({ page, request }) => {
  await installOverlay(page);

  // ── Title ───────────────────────────────────────────────────────────────
  await page.goto("/login");
  await card(page, "Renewing a loan", [
    "It is now a process: draft → contract → signed → finalize.",
    "Any reviewer or admin can do it, and it can be cancelled right up to the last step."
  ]);
  await beat(page, 5200);
  await hideCard(page);

  // ── 1. Reviewer signs in ────────────────────────────────────────────────
  await signIn(
    page,
    "ana",
    "Ana is a reviewer. Until now only an admin could renew a loan; now she can too."
  );
  await say(page, "Her menu has Search. Tasks, Reports and the copilot stay admin-only.", 3200);

  // ── 2. Unified search ───────────────────────────────────────────────────
  await page.getByRole("button", { name: "Búsqueda" }).click();
  await say(page, "One search: customers, loans and past applications.", 2200);
  await typeInto(page, page.getByPlaceholder(SEARCH), "pablo");
  await expect(page.getByRole("button", { name: "Ver perfil" }).first()).toBeVisible();
  await expect(page.getByTestId("search-application")).toHaveCount(1);
  await say(
    page,
    "His converted application shows up. His other two (a draft and an abandoned one) do not: they have no value.",
    4200
  );
  await page.getByPlaceholder(SEARCH).fill("");
  await page.getByPlaceholder(SEARCH).pressSequentially("001-0000051-1", { delay: 70 });
  await say(page, "By cédula too, with or without dashes. And by phone.", 2800);
  await page.getByPlaceholder(SEARCH).fill("");
  await page.getByPlaceholder(SEARCH).pressSequentially("pablo", { delay: 70 });
  await beat(page, 900);

  // ── 3. Customer profile ─────────────────────────────────────────────────
  await page.getByRole("button", { name: "Ver perfil" }).first().click();
  const profile = page.getByTestId("customer-panel");
  await expect(profile).toBeVisible();
  await say(page, '"Ver perfil" opens the customer profile in the side panel.', 2600);
  await say(page, "Customer data is edited right here: name, phone, cédula, address…", 2600);
  await profile.getByTestId("customer-tab-documentos").click();
  await say(page, "Documents can be seen and uploaded: cédula, business photos, contracts.", 2400);
  await profile.getByTestId("customer-upload-input").setInputFiles({
    name: "cedula-frente.png",
    mimeType: "image/png",
    buffer: PNG
  });
  await expect(profile.getByTestId("customer-doc")).toHaveCount(1);
  await say(page, "Reviewers upload; only an admin can delete.", 2800);
  await profile.getByTestId("customer-tab-solicitudes").click();
  await say(page, "His past applications, one click away.", 2400);

  // ── 4. Start the renewal ────────────────────────────────────────────────
  await profile.getByTestId("customer-tab-prestamos").click();
  await say(
    page,
    'On the active loan, "Renovar" is a quiet button, not the star of the screen.',
    3200
  );
  await profile.getByTestId("customer-renew").click();
  const panel = page.getByTestId("renewal-panel");
  await expect(panel.getByTestId("renewal-status")).toHaveAttribute("data-status", "DRAFT");
  await say(page, "It starts a draft. Nothing is closed, created or posted yet.", 3400);
  await say(
    page,
    "He owes RD$2,600 on the old loan today. With a new RD$10,000 loan, RD$7,400 leaves the account.",
    4400
  );

  // ── 5. Terms ────────────────────────────────────────────────────────────
  await typeInto(page, panel.getByTestId("renewal-principal"), "12000");
  await expect(panel.getByTestId("renewal-net")).toHaveText("RD$9,400");
  await say(
    page,
    "With RD$12,000: 12,000 − 2,600 = 9,400. Only the difference reaches the ledger.",
    4200
  );
  await typeInto(page, panel.getByTestId("renewal-principal"), "2000");
  await expect(panel.getByTestId("renewal-net-error")).toBeVisible();
  await say(page, "If the new loan does not cover what is owed, it will not let you save.", 3400);
  await typeInto(page, panel.getByTestId("renewal-principal"), "12000");
  await panel.getByTestId("renewal-save-terms").click();
  await expect(panel.getByTestId("renewal-net")).toHaveText("RD$9,400");
  await beat(page, 1400);

  // ── 6. Contract ─────────────────────────────────────────────────────────
  await panel.getByTestId("renewal-tab-contrato").click();
  await say(
    page,
    "Contract: generated from the new terms only, never from the old loan's debt.",
    3200
  );
  await panel.getByTestId("renewal-generate-contract").click();
  await expect(panel.getByTestId("renewal-status")).toHaveAttribute(
    "data-status",
    "CONTRACT_READY"
  );
  await say(
    page,
    "Contract ready. If the terms change, it is cleared and must be generated again.",
    3400
  );

  // ── 7. Signed copy ──────────────────────────────────────────────────────
  await say(page, "The customer signs it and the signed copy (PDF) is uploaded.", 2600);
  await panel.getByTestId("renewal-signed-upload-input").setInputFiles({
    name: "contrato-firmado-pablo.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4 contrato firmado por el cliente")
  });
  await expect(panel.getByTestId("renewal-status")).toHaveAttribute("data-status", "SIGNED");
  await say(page, "Ready to finalize.", 2200);
  await panel.getByTestId("renewal-tab-documentos").click();
  await say(page, "Additional information can be attached to the renewal too.", 3000);

  // ── 8. Finalize, with the amount changing underneath ────────────────────
  await panel.getByTestId("renewal-tab-finalizar").click();
  await say(page, "Finalize: she confirms the exact amount that will leave the account.", 3200);
  await panel.getByTestId("renewal-confirm").check();
  await say(page, "Ana confirms RD$9,400…", 2000);

  const adminToken = await apiLogin(request, PHONES.admin);
  const whoami = await trpc<{ id: string }>(
    request,
    await apiLogin(request, "8292000004"),
    "query",
    "whoami",
    {}
  );
  await say(
    page,
    "…but while she reviews, the customer pays a RD$1,300 cuota to the collector.",
    3600
  );
  const loanNumber = Number(
    (await page.getByTestId("renewal-panel").locator("h2").innerText()).match(/#(\d+)/)![1]
  );
  await trpc(request, adminToken, "mutation", "createPayment", {
    loanId: loanNumber,
    amount: 1300,
    method: "CASH",
    collectedById: whoami.id
  });
  // The panel re-reads the amount when the window regains focus (and every 30s).
  await page.evaluate(() =>
    document.dispatchEvent(new Event("visibilitychange", { bubbles: true }))
  );
  await expect(panel.getByTestId("renewal-net-changed")).toBeVisible();
  await say(
    page,
    "The amount changed. Nothing was written and her confirmation was withdrawn: Ana must accept the new amount.",
    4800
  );
  await panel.getByTestId("renewal-confirm").check();
  await expect(panel.getByTestId("renewal-net")).toHaveText("RD$10,700");
  await say(page, "He now owes RD$1,300 less: 12,000 − 1,300 = 10,700. She confirms again.", 3600);
  await panel.getByTestId("renewal-finalize-button").click();
  await expect(panel.getByTestId("renewal-done")).toBeVisible();
  await expect(panel.getByTestId("renewal-status")).toHaveAttribute("data-status", "COMPLETED");
  await say(
    page,
    'Done: the old loan becomes "Renovado", the new one is created, and the disbursement is recorded.',
    4200
  );

  // The ledger line, read back from the real API.
  const today = new Date();
  const txs = await trpc<Array<{ type: string; amount: unknown; reference: string | null }>>(
    request,
    adminToken,
    "query",
    "accounting.listTransactions",
    {
      startDate: new Date(today.getTime() - 86_400_000).toISOString(),
      endDate: new Date(today.getTime() + 86_400_000).toISOString(),
      limit: 20
    }
  );
  const ledger = txs.find((t) => t.reference?.startsWith("loan-renewal:"));
  if (ledger) {
    await say(
      page,
      `Ledger (read back from the database): ${ledger.type} of RD$${Number(ledger.amount).toLocaleString("en-US")} — ${ledger.reference}. Only the difference.`,
      5200
    );
  }

  // ── 9. Customer's loans and the feed ────────────────────────────────────
  await panel.getByRole("button", { name: "Ver préstamos del cliente" }).click();
  await expect(page.getByTestId("customer-panel")).toBeVisible();
  await say(page, 'On the profile: the old loan "Renovado" and the new one "Activo".', 3600);
  await page.keyboard.press("Escape");
  await page.goto("/ops");
  const done = page.getByTestId("renewal-card").filter({ hasText: "Pablo Renovación" });
  await expect(done).toHaveAttribute("data-status", "COMPLETED");
  await say(page, "And in the feed, a single card per renewal, always in its current state.", 3800);

  // ── 10. Cancel ──────────────────────────────────────────────────────────
  await page.getByRole("button", { name: "Búsqueda" }).click();
  await say(page, "Another renewal: Lucía's, which is going to be cancelled.", 2600);
  await typeInto(page, page.getByPlaceholder(SEARCH), "lucía");
  await expect(page.getByRole("button", { name: "Renovar", exact: true })).toBeVisible();
  await say(page, "A loan can also be renewed straight from the search result.", 3000);
  await page.getByRole("button", { name: "Renovar", exact: true }).click();
  await expect(panel.getByTestId("renewal-status")).toHaveAttribute("data-status", "DRAFT");
  await panel.getByTestId("renewal-tab-contrato").click();
  await panel.getByTestId("renewal-generate-contract").click();
  await expect(panel.getByTestId("renewal-status")).toHaveAttribute(
    "data-status",
    "CONTRACT_READY"
  );
  await say(
    page,
    "The customer changes her mind. It can be cancelled at any point before finalizing.",
    3600
  );
  await panel.getByTestId("renewal-tab-terminos").click();
  await panel.getByTestId("renewal-cancel").click();
  await expect(page.getByTestId("renewal-cancel-dialog")).toBeVisible();
  await say(page, "The loan stays active and no money moves. Documents stay on the profile.", 4200);
  await page.getByTestId("renewal-cancel-confirm").click();
  await expect(panel.getByTestId("renewal-status")).toHaveAttribute("data-status", "CANCELLED");
  await beat(page, 1600);
  await page.keyboard.press("Escape");
  await page.goto("/ops");
  const cancelled = page.getByTestId("renewal-card").filter({ hasText: "Lucía Renovación" });
  await expect(cancelled).toHaveAttribute("data-status", "CANCELLED");
  await say(
    page,
    'The same card, now "Cancelada", with the option to start another renewal.',
    4200
  );

  // ── End card ────────────────────────────────────────────────────────────
  await card(page, "That is it", [
    "Admins and reviewers: search, open profiles, renew.",
    "Loans and the ledger are only touched at the end — and only by the difference.",
    "If the amount changes along the way, it has to be confirmed again."
  ]);
  await caption(page, null);
  await beat(page, 6500);
});
