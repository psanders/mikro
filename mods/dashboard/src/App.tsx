/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { trpc, createTrpcClient } from "./lib/trpc";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ToastProvider } from "./components/ui/ToastProvider";
import { AppUpdater } from "./components/AppUpdater";
import { WindowTitle } from "./components/WindowTitle";
import { CustomTitleBar } from "./components/CustomTitleBar";
import { LoginPage } from "./pages/LoginPage";
import { AccessScreen } from "./founder/AccessScreen";
import { FounderShell } from "./founder/FounderShell";
import { FeedScreen } from "./founder/FeedScreen";
import { BusquedaScreen } from "./founder/BusquedaScreen";
import { ReportesScreen } from "./founder/ReportesScreen";
import { TareasScreen } from "./founder/TareasScreen";

function FullscreenLoading() {
  return (
    <div className="flex h-full items-center justify-center bg-slate-100 text-sm text-slate-500">
      Cargando…
    </div>
  );
}

/**
 * Guards every authenticated route. Unauthenticated users bounce to login.
 * ADMIN users fall through (via `<Outlet />`) to the founder app; every other
 * role (COLLECTOR/REVIEWER) sees the access screen instead — the operations UI
 * is retired, so there is no other authenticated surface for them to reach.
 */
function RequireAuth() {
  const { isAuthenticated } = useAuth();
  const whoami = trpc.whoami.useQuery(undefined, { enabled: isAuthenticated });
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (whoami.isPending) return <FullscreenLoading />;
  const isAdmin = whoami.data?.roles?.includes("ADMIN") ?? false;
  return isAdmin ? <Outlet /> : <AccessScreen />;
}

function AppRoutes() {
  const { loading, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-100 text-sm text-slate-500">
        Cargando…
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/founder" replace /> : <LoginPage />}
      />
      <Route element={<RequireAuth />}>
        <Route path="/founder" element={<FounderShell />}>
          <Route index element={<FeedScreen />} />
          <Route path="buscar" element={<BusquedaScreen />} />
          <Route path="reportes" element={<ReportesScreen />} />
          <Route path="tareas" element={<TareasScreen />} />
        </Route>
        {/* Unknown paths (including any retired operations route) redirect
            admins to the founder app; the access screen already caught
            non-admins above. */}
        <Route path="*" element={<Navigate to="/founder" replace />} />
      </Route>
    </Routes>
  );
}

export function App() {
  // Created once; the tRPC client reads the token per-request, so it survives
  // login/logout without recreation.
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() => createTrpcClient());

  return (
    <QueryClientProvider client={queryClient}>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <AuthProvider>
          <ToastProvider>
            <AppUpdater />
            <WindowTitle />
            <div className="flex flex-col h-screen bg-white">
              <CustomTitleBar />
              <div className="flex-1 overflow-hidden">
                <BrowserRouter>
                  <AppRoutes />
                </BrowserRouter>
              </div>
            </div>
          </ToastProvider>
        </AuthProvider>
      </trpc.Provider>
    </QueryClientProvider>
  );
}
