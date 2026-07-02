/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Terminating tRPC link used only in e2e builds (wired in `api.ts`/`trpc.ts`
 * behind `IS_E2E`). It resolves the evaluator flow's procedures against the
 * in-memory `e2eFixtures` store instead of hitting HTTP, so Maestro can drive
 * datos / edit / descartar / document flows with no backend. Procedures not
 * listed here resolve to `null` (nothing in the exercised flows needs them).
 */
import { TRPCClientError, type TRPCLink } from "@trpc/client";
import { observable } from "@trpc/server/observable";
import type { AppRouter } from "@mikro/apiserver";
import {
  E2E_USERS,
  e2eDeleteApplication,
  e2eGetApplication,
  e2eListApplications,
  e2eSetContract,
  e2eSetIdImage,
  e2eSetStatus,
  e2eUpdateApplication
} from "./e2eFixtures";

function resolve(path: string, input: unknown): unknown {
  switch (path) {
    case "listApplications":
      return e2eListApplications((input as { status?: string } | undefined)?.status);
    case "getApplication":
      return e2eGetApplication((input as { id?: string } | undefined) ?? {});
    case "listUsers":
      return E2E_USERS;
    case "claimApplication":
      return e2eSetStatus(input as { id?: string }, "IN_REVIEW");
    case "approveApplication":
      return e2eSetStatus(input as { id?: string }, "APPROVED");
    case "reopenApplication":
      return e2eSetStatus(input as { id?: string }, "IN_REVIEW");
    case "rejectApplication":
      return e2eSetStatus(input as { id?: string }, "REJECTED");
    case "updateApplication":
      return e2eUpdateApplication(input as { id?: string; patch: Record<string, string> });
    case "deleteApplication":
      return e2eDeleteApplication(input as { id?: string });
    case "uploadIdImage":
      return e2eSetIdImage(input as { id?: string; side: "FRONT" | "BACK" }, true);
    case "deleteIdImage":
      return e2eSetIdImage(input as { id?: string; side: "FRONT" | "BACK" }, false);
    case "uploadSignedContract":
      return e2eSetContract(input as { id?: string }, true);
    case "deleteApplicationContract":
      return e2eSetContract(input as { id?: string }, false);
    case "getApplicationContract":
      return { dataBase64: "", filename: "e2e-contrato.pdf" };
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
