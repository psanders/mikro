/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import type { AppRouter } from "@mikro/apiserver";
import { getToken } from "./auth";
import { authErrorLink } from "./authErrorLink";

const API_URL = process.env.EXPO_PUBLIC_API_URL!;

export function createApiClient(tokenOverride?: string) {
  return createTRPCClient<AppRouter>({
    links: [
      authErrorLink,
      httpBatchLink({
        url: `${API_URL}/trpc`,
        async headers() {
          const token = tokenOverride ?? (await getToken());
          if (!token) return {};
          return { Authorization: `Bearer ${token}` };
        }
      })
    ]
  });
}

export const api = createApiClient();
