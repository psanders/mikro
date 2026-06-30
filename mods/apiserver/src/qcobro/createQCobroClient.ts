/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Internal QCobro HTTP client. `@qcobro/sdk` is referenced in the design docs
 * but is not (yet) a published package this repo can depend on, so this is a
 * thin fetch-based stand-in with the same shape the sync service needs:
 * upsert an account, then reconcile its portfolio memberships. Swap the
 * implementation for the real SDK once it's available — `createSyncCustomerToQCobro`
 * only depends on the `QCobroClient` interface below, not on `fetch` directly.
 *
 * Endpoint shapes and auth headers are best-effort REST conventions, not
 * confirmed against QCobro's actual API (see design.md "QCobro auth specifics"
 * open question) — expect to adjust once real credentials/docs are in hand.
 */
import type { QCobroConfig } from "@mikro/common";
import { logger } from "../logger.js";

export interface UpsertAccountInput {
  externalId: string;
  name: string;
  phone: string;
  balance: number;
}

export interface SetPortfoliosInput {
  externalId: string;
  add: string[];
  remove: string[];
}

export interface QCobroClient {
  upsertAccount(input: UpsertAccountInput): Promise<void>;
  setPortfolios(input: SetPortfoliosInput): Promise<void>;
}

/** No-op client used when qcobro credentials are still placeholders (nothing configured yet). */
export function createNoopQCobroClient(): QCobroClient {
  return {
    async upsertAccount(input) {
      logger.verbose("qcobro: skipping upsertAccount (placeholder credentials)", {
        externalId: input.externalId
      });
    },
    async setPortfolios(input) {
      logger.verbose("qcobro: skipping setPortfolios (placeholder credentials)", {
        externalId: input.externalId
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

function createHttpQCobroClient(cfg: QCobroConfig): QCobroClient {
  const baseUrl = cfg.apiUrl.replace(/\/+$/, "");
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${cfg.apiKey}`,
    "X-QCobro-Secret": cfg.apiSecret,
    "X-QCobro-Workspace": cfg.workspace
  };

  async function request(path: string, init: RequestInit): Promise<void> {
    const res = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: { ...headers, ...init.headers }
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`QCobro API ${init.method ?? "GET"} ${path} failed: ${res.status} ${body}`);
    }
  }

  return {
    async upsertAccount(input) {
      await request(`/v1/workspaces/${cfg.workspace}/accounts`, {
        method: "POST",
        body: JSON.stringify({
          externalId: input.externalId,
          name: input.name,
          phone: input.phone,
          balance: input.balance,
          syncMode: cfg.syncMode
        })
      });
    },
    async setPortfolios(input) {
      for (const portfolioId of input.add) {
        await request(
          `/v1/workspaces/${cfg.workspace}/accounts/${input.externalId}/portfolios/${portfolioId}`,
          { method: "POST" }
        );
      }
      for (const portfolioId of input.remove) {
        await request(
          `/v1/workspaces/${cfg.workspace}/accounts/${input.externalId}/portfolios/${portfolioId}`,
          { method: "DELETE" }
        );
      }
    }
  };
}

/** Real client when credentials are configured, otherwise a logging no-op. */
export function createQCobroClient(cfg: QCobroConfig): QCobroClient {
  if (!isQCobroConfigured(cfg)) return createNoopQCobroClient();
  return createHttpQCobroClient(cfg);
}
