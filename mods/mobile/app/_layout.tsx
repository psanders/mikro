/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { useEffect, useRef } from "react";
import { Alert, AppState } from "react-native";
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
import { getPin, getToken, clearToken } from "../lib/auth";
import { setSessionExpiredHandler } from "../lib/session";

const E2E = process.env.EXPO_PUBLIC_E2E === "1";

// Forces a clean logout when the API rejects the session (expired/invalid JWT).
// Clears ONLY the auth token — the local SQLite database, pending mutations and
// the user's PIN are left intact, so unsynced payments survive and push after
// the collector signs in again.
function useSessionExpiry() {
  const router = useRouter();
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  useEffect(() => {
    if (E2E) return;
    setSessionExpiredHandler(() => {
      // usePathname() strips route groups: "/(auth)/login" is "/login".
      const authScreens = ["/", "/login", "/unlock"];
      void getToken().then((token) =>
        clearToken().finally(() => {
          // Only announce an expiry when a session actually existed and the
          // user was past the auth screens — a fresh install firing an
          // unauthenticated request must not see "Sesión expirada".
          if (token && !authScreens.includes(pathRef.current)) {
            Alert.alert(
              "Sesión expirada",
              "Tu sesión venció. Inicia sesión de nuevo para continuar."
            );
          }
          router.replace("/(auth)/login");
        })
      );
    });
    return () => setSessionExpiredHandler(null);
  }, [router]);
}

function useAppLock() {
  const router = useRouter();
  const pathname = usePathname();
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    const sub = AppState.addEventListener("change", async (nextState) => {
      if (appState.current.match(/background/) && nextState === "active") {
        // usePathname() strips route groups: "/(auth)/login" is "/login".
        const authScreens = ["/", "/login", "/unlock", "/cambiar-pin"];
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
  useSessionExpiry();

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
            <Stack.Screen name="(evaluator)" />
            <Stack.Screen name="cliente/[id]" options={{ animation: "slide_from_right" }} />
            <Stack.Screen name="solicitud/[id]" options={{ animation: "slide_from_right" }} />
            <Stack.Screen name="solicitud/[id]/datos" options={{ animation: "slide_from_right" }} />
            <Stack.Screen
              name="solicitud/[id]/editar-negocio"
              options={{ presentation: "modal" }}
            />
            <Stack.Screen name="solicitud/[id]/rechazar" options={{ presentation: "modal" }} />
            <Stack.Screen
              name="solicitud/[id]/generar-contrato"
              options={{ presentation: "modal" }}
            />
            <Stack.Screen name="solicitud/[id]/convertir" options={{ presentation: "modal" }} />
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
