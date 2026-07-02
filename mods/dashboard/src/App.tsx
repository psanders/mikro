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
import { Layout } from "./components/Layout";
import { LoginPage } from "./pages/LoginPage";
import { OverviewPage } from "./pages/OverviewPage";
import { SolicitudesPage } from "./pages/SolicitudesPage";
import { SolicitudDetailPage } from "./pages/SolicitudDetailPage";
import { ClientesPage } from "./pages/ClientesPage";
import { ClienteDetailPage } from "./pages/ClienteDetailPage";
import { ContabilidadPage } from "./pages/ContabilidadPage";
import { TransaccionDetailPage } from "./pages/TransaccionDetailPage";
import { ModeloPage } from "./pages/ModeloPage";
import { FounderShell } from "./founder/FounderShell";
import { FeedScreen } from "./founder/FeedScreen";
import { BusquedaScreen } from "./founder/BusquedaScreen";
import { ReportesScreen } from "./founder/ReportesScreen";

function FullscreenLoading() {
  return (
    <div className="flex h-full items-center justify-center bg-slate-100 text-sm text-slate-500">
      Cargando…
    </div>
  );
}

/** Renders the authenticated ops shell, or bounces to login when unauthenticated. */
function RequireAuth() {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <Layout /> : <Navigate to="/login" replace />;
}

/**
 * Guards the self-contained founder app: authenticated + ADMIN only. Renders
 * the founder shell OUTSIDE the ops Layout. Non-admins bounce to their normal
 * landing ("/"); unauthenticated users bounce to login.
 */
function RequireFounder() {
  const { isAuthenticated } = useAuth();
  const whoami = trpc.whoami.useQuery(undefined, { enabled: isAuthenticated });
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (whoami.isPending) return <FullscreenLoading />;
  const isAdmin = whoami.data?.roles?.includes("ADMIN") ?? false;
  return isAdmin ? <FounderShell /> : <Navigate to="/" replace />;
}

/** ADMIN's default landing is the founder app; every other role keeps Inicio. */
function IndexRoute() {
  const whoami = trpc.whoami.useQuery();
  if (whoami.isPending) return null;
  const isAdmin = whoami.data?.roles?.includes("ADMIN") ?? false;
  return isAdmin ? <Navigate to="/founder" replace /> : <OverviewPage />;
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
        element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />}
      />
      <Route element={<RequireAuth />}>
        <Route path="/" element={<Outlet />}>
          <Route index element={<IndexRoute />} />
          <Route path="solicitudes" element={<SolicitudesPage />} />
          <Route path="solicitudes/:id" element={<SolicitudDetailPage />} />
          <Route path="clientes" element={<ClientesPage />} />
          <Route path="clientes/:id" element={<ClienteDetailPage />} />
          <Route path="contabilidad" element={<ContabilidadPage />} />
          <Route path="contabilidad/:id" element={<TransaccionDetailPage />} />
          <Route path="modelo" element={<ModeloPage />} />
        </Route>
      </Route>
      <Route path="/founder" element={<RequireFounder />}>
        <Route index element={<FeedScreen />} />
        <Route path="buscar" element={<BusquedaScreen />} />
        <Route path="reportes" element={<ReportesScreen />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
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
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </ToastProvider>
        </AuthProvider>
      </trpc.Provider>
    </QueryClientProvider>
  );
}
