/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import type { AppRouter } from "@mikro/apiserver";
import { QueryClient } from "@tanstack/react-query";
import { getToken } from "./auth";
import { authErrorLink } from "./authErrorLink";

export const trpc = createTRPCReact<AppRouter>();

const API_URL = process.env.EXPO_PUBLIC_API_URL!;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60_000,
      gcTime: 5 * 60_000,
      retry: 2,
      refetchOnWindowFocus: false
    }
  }
});

export const trpcClient = trpc.createClient({
  links: [
    authErrorLink,
    httpBatchLink({
      url: `${API_URL}/trpc`,
      async headers() {
        const token = await getToken();
        return token ? { Authorization: `Bearer ${token}` } : {};
      }
    })
  ]
});
