/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { TRPCLink } from "@trpc/client";
import { observable } from "@trpc/server/observable";
import type { AppRouter } from "@mikro/apiserver";
import { isUnauthorizedError, notifySessionExpired } from "./session";

/**
 * tRPC link that watches every response and, when the server rejects the
 * session (expired / invalid token), triggers a global clean logout. Placed
 * before the terminating http link so all clients share the behavior. Mirrors
 * the mobile app's authErrorLink.
 */
export const authErrorLink: TRPCLink<AppRouter> = () => {
  return ({ next, op }) =>
    observable((observer) => {
      const subscription = next(op).subscribe({
        next(value) {
          observer.next(value);
        },
        error(err) {
          if (isUnauthorizedError(err)) notifySessionExpired();
          observer.error(err);
        },
        complete() {
          observer.complete();
        }
      });
      return subscription;
    });
};
