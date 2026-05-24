/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import type { AppRouter } from "@mikro/apiserver";
import { QueryClient } from "@tanstack/react-query";
import { getToken } from "./auth";

export const trpc = createTRPCReact<AppRouter>();

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://192.168.1.15:4000";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 2
    }
  }
});

export const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: `${API_URL}/trpc`,
      async headers() {
        const token = await getToken();
        return token ? { Authorization: `Bearer ${token}` } : {};
      }
    })
  ]
});
