/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { trpc, createTrpcClient } from "./lib/trpc";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ToastProvider } from "./components/ui/ToastProvider";
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

/** Renders the authenticated shell, or bounces to login when unauthenticated. */
function RequireAuth() {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <Layout /> : <Navigate to="/login" replace />;
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
          <Route index element={<OverviewPage />} />
          <Route path="solicitudes" element={<SolicitudesPage />} />
          <Route path="solicitudes/:id" element={<SolicitudDetailPage />} />
          <Route path="clientes" element={<ClientesPage />} />
          <Route path="clientes/:id" element={<ClienteDetailPage />} />
          <Route path="contabilidad" element={<ContabilidadPage />} />
          <Route path="contabilidad/:id" element={<TransaccionDetailPage />} />
          <Route path="modelo" element={<ModeloPage />} />
        </Route>
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
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </ToastProvider>
        </AuthProvider>
      </trpc.Provider>
    </QueryClientProvider>
  );
}
