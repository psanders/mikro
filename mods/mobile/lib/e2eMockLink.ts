/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Terminating tRPC link used only in e2e builds (wired in `api.ts`/`trpc.ts`
 * behind `IS_E2E`). It resolves the collector flows' procedures against the
 * in-memory `e2eFixtures` instead of hitting HTTP, so Maestro runs with no
 * backend. Procedures not listed here resolve to `null`.
 */
import { TRPCClientError, type TRPCLink } from "@trpc/client";
import { observable } from "@trpc/server/observable";
import type { AppRouter } from "@mikro/apiserver";
import {
  E2E_USERS,
  e2eEvidenceQueue,
  e2eEvidenceTask,
  e2eSendPromo,
  e2eSetMapUrl
} from "./e2eFixtures";

function resolve(path: string, input: unknown): unknown {
  switch (path) {
    case "listUsers":
      return E2E_USERS;
    case "sendPromo":
      return e2eSendPromo();
    case "listEvidenceQueue":
      return e2eEvidenceQueue();
    case "getEvidenceTask":
      return e2eEvidenceTask();
    case "setApplicationMapUrl":
      return e2eSetMapUrl(input);
    default:
      return null;
  }
}

export const e2eMockLink: TRPCLink<AppRouter> = () => {
  return ({ op }) =>
    observable((observer) => {
      try {
        const data = resolve(op.path, op.input);
        observer.next({ result: { type: "data", data } });
        observer.complete();
      } catch (err) {
        observer.error(TRPCClientError.from(err instanceof Error ? err : new Error(String(err))));
      }
    });
};
