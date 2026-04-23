/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import type { AppRouter } from "@mikro/apiserver"; // type-only, no runtime dependency

/**
 * Creates a typed tRPC client for the Mikro API.
 * Sends `Authorization: Bearer <token>` with every request.
 *
 * @param baseUrl - The base URL of the API server
 * @param token - A Bearer JWT issued by the API's login mutation
 * @returns A typed tRPC client
 */
export function createClient(baseUrl: string, token: string) {
  return createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: `${baseUrl}/trpc`,
        headers: () => ({
          Authorization: `Bearer ${token}`
        })
      })
    ]
  });
}
