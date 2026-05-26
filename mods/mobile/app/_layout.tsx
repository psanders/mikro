/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { Stack, useRouter, usePathname } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  useFonts,
  Geist_400Regular,
  Geist_500Medium,
  Geist_600SemiBold,
  Geist_700Bold
} from "@expo-google-fonts/geist";
import { QueryClientProvider } from "@tanstack/react-query";
import { trpc, trpcClient, queryClient } from "../lib/api";
import { SyncProvider } from "../lib/offline/SyncProvider";
import { getPin } from "../lib/auth";

function useAppLock() {
  const router = useRouter();
  const pathname = usePathname();
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    const sub = AppState.addEventListener("change", async (nextState) => {
      if (appState.current.match(/background/) && nextState === "active") {
        const authScreens = ["/", "/(auth)/login", "/(auth)/unlock", "/cambiar-pin"];
        if (!authScreens.includes(pathname)) {
          const pin = await getPin();
          if (pin) {
            router.push({ pathname: "/(auth)/unlock", params: { resume: "1" } });
          }
        }
      }
      appState.current = nextState;
    });
    return () => sub.remove();
  }, [pathname, router]);
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
    Geist_700Bold
  });

  useAppLock();

  if (!fontsLoaded) return null;

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <SyncProvider>
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="cliente/[id]" options={{ animation: "slide_from_right" }} />
            <Stack.Screen name="prestamo/[loanId]" options={{ animation: "slide_from_right" }} />
            <Stack.Screen name="cobrar/[loanId]" options={{ presentation: "modal" }} />
            <Stack.Screen name="pago-confirmado" options={{ animation: "fade" }} />
            <Stack.Screen name="visita/[id]" options={{ presentation: "modal" }} />
            <Stack.Screen name="sincronizar" options={{ animation: "slide_from_right" }} />
            <Stack.Screen name="historico/[loanId]" options={{ animation: "slide_from_right" }} />
            <Stack.Screen name="perfil" options={{ animation: "slide_from_right" }} />
          </Stack>
        </SyncProvider>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
