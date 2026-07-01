/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * QCobro client, backed by the real `@qcobro/sdk` (published 2026-06-30, see
 * github.com/psanders/mikro/issues/55 for the history). Everything else
 * (`createSyncAllPortfolios.ts`) only depends on the `QCobroClient` interface
 * below, not on the SDK directly, so this stays the single integration point.
 *
 * Auth: `client.loginWithApiKey({accessKeyId, accessKeySecret})` maps to
 * `qcobro.apiKey`/`qcobro.apiSecret`; the SDK stores the issued access +
 * refresh token and auto-refreshes on an `UNAUTHORIZED` reply, so no manual
 * retry logic is needed here. `qcobro.workspace` is the workspace's
 * accessKeyId, passed once as `ClientOptions.workspace`.
 *
 * `portfolios.syncAccounts` pushes a **batch** of account rows into **one**
 * portfolio per call; `mode: REPLACE` replaces that portfolio's entire account
 * set with whatever is in `rows` (`rows` must be non-empty — there is no way
 * to express "this portfolio now has zero matching accounts" through this
 * call). `createSyncAllPortfolios.ts` calls this once per portfolio per tick
 * with every currently-matching customer, never per customer — see that file
 * for why.
 */
import { Client } from "@qcobro/sdk";
import type { QCobroConfig } from "@mikro/common";
import { logger } from "../logger.js";

/** Mirrors `accountRowSchema` in `@qcobro/common`. Only fields Mikro can actually populate are required. */
export interface AccountRow {
  externalId: string;
  fullName: string;
  phone?: string;
  principalAmount?: number;
  termsAmount?: number;
  termsFrequency?: string;
  termsLength?: number;
  outstandingBalance: number;
  daysPastDue?: number;
  missedInstallments?: number;
  lastPaymentDate?: string;
  lastPaymentAmount?: number;
}

export interface SyncAccountsInput {
  portfolioId: string;
  mode: QCobroConfig["syncMode"];
  /** Must be non-empty — the real API has no "clear this portfolio" call. */
  rows: AccountRow[];
}

export interface QCobroClient {
  syncAccounts(input: SyncAccountsInput): Promise<void>;
}

/** No-op client used when qcobro credentials are still placeholders (nothing configured yet). */
export function createNoopQCobroClient(): QCobroClient {
  return {
    async syncAccounts(input) {
      logger.verbose("qcobro: skipping syncAccounts (placeholder credentials)", {
        portfolioId: input.portfolioId,
        rowCount: input.rows.length
      });
    }
  };
}

/** True while qcobro.apiKey/apiSecret/workspace are still the documented placeholders. */
export function isQCobroConfigured(cfg: QCobroConfig): boolean {
  return (
    !cfg.apiKey.endsWith("_PLACEHOLDER") &&
    !cfg.apiSecret.endsWith("_PLACEHOLDER") &&
    !cfg.workspace.endsWith("_PLACEHOLDER")
  );
}

/**
 * Logs the push that would happen, but never calls the network. Real
 * credentials still drive real tag computation and portfolio-rule evaluation —
 * only the push itself is disabled. Useful while iterating on tags/portfolio
 * rules without touching the real QCobro account.
 */
function createDryRunQCobroClient(cfg: QCobroConfig): QCobroClient {
  return {
    async syncAccounts(input) {
      logger.info("qcobro [DRY RUN]: would syncAccounts", {
        workspace: cfg.workspace,
        portfolioId: input.portfolioId,
        mode: input.mode,
        rowCount: input.rows.length,
        rows: input.rows
      });
    }
  };
}

/**
 * Real client via `@qcobro/sdk`. Authenticates lazily on first use and caches
 * for this client's lifetime (one sync pass — see createSyncAllPortfolios.ts);
 * a fresh client is created (and re-authenticates) on the next pass. The SDK
 * itself handles token refresh on `UNAUTHORIZED` mid-pass.
 */
function createHttpQCobroClient(cfg: QCobroConfig): QCobroClient {
  const client = new Client({ endpoint: cfg.apiUrl, workspace: cfg.workspace });
  let authenticated = false;

  async function ensureAuthenticated(): Promise<void> {
    if (authenticated) return;
    await client.loginWithApiKey({ accessKeyId: cfg.apiKey, accessKeySecret: cfg.apiSecret });
    authenticated = true;
    logger.verbose("qcobro: authenticated", { workspace: cfg.workspace });
  }

  return {
    async syncAccounts(input) {
      await ensureAuthenticated();
      await client.portfolios.syncAccounts(input);
      logger.info("qcobro: syncAccounts pushed", {
        portfolioId: input.portfolioId,
        mode: input.mode,
        rowCount: input.rows.length
      });
    }
  };
}

/**
 * Real credentials -> dry-run (logs intent) or real client, per `qcobro.dryRun`.
 * Placeholders -> silent no-op regardless.
 */
export function createQCobroClient(cfg: QCobroConfig): QCobroClient {
  if (!isQCobroConfigured(cfg)) return createNoopQCobroClient();
  return cfg.dryRun ? createDryRunQCobroClient(cfg) : createHttpQCobroClient(cfg);
}
