/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { httpBatchLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "@mikro/apiserver";
import { getToken } from "./auth";
import { authErrorLink } from "./authErrorLink";

const API_URL = import.meta.env.VITE_API_URL;

if (!API_URL) {
  // Fail loudly in dev rather than firing requests at a relative path.
  console.error("VITE_API_URL is not set — API requests will fail. See .env.example.");
}

/** Typed tRPC + React Query hooks for the whole app (e.g. `trpc.whoami.useQuery()`). */
export const trpc = createTRPCReact<AppRouter>();

/**
 * Builds the tRPC client. `headers()` reads the token fresh on every request, so
 * the client never needs recreating on login/logout. Mirrors mobile/lib/trpc.ts.
 */
export function createTrpcClient() {
  return trpc.createClient({
    links: [
      authErrorLink,
      httpBatchLink({
        url: `${API_URL}/trpc`,
        async headers() {
          const token = await getToken();
          if (!token) return {};
          return { Authorization: `Bearer ${token}` };
        }
      })
    ]
  });
}
