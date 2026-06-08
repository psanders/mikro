/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { useState, type FormEvent } from "react";
import { Phone, Lock, ArrowRight } from "lucide-react";
import { trpc } from "../lib/trpc";
import { useAuth } from "../context/AuthContext";
import { Field } from "../components/ui/Field";
import { Button } from "../components/ui/Button";

// Re-implements Pencil "Operations / 01 Inicio de sesión" (RRbG1): a gradient
// brand panel beside a white centered form. Auth wiring (login mutation, token,
// session) is unchanged from the foundation. Note: the mockup shows an email
// field, but Mikro auth is phone-based (E.164), so the first field is Teléfono.
export function LoginPage() {
  const { completeLogin } = useAuth();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");

  const login = trpc.login.useMutation({
    onSuccess: async (result) => {
      await completeLogin(result);
    }
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    login.mutate({ phone, password });
  }

  return (
    <div className="flex h-full">
      {/* Brand panel */}
      <div className="hidden w-[560px] flex-col justify-between bg-[linear-gradient(135deg,#103A8A,#1F4AA8)] p-[60px] text-brand-white lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-[46px] w-[46px] items-center justify-center rounded-[11px] border border-white/25 bg-[linear-gradient(135deg,#3F86E0,#1F4AA8)] text-[22px] font-extrabold">
            m
          </div>
          <span className="text-2xl font-bold tracking-[-0.4px]">mikro</span>
        </div>

        <div className="flex flex-col gap-4">
          <span className="text-[13px] font-medium tracking-[1.4px] text-white/70">mikro ops</span>
          <h1 className="max-w-[440px] text-[40px] font-bold leading-[1.1] tracking-[-1px]">
            Opera tu cartera
            <br />
            en un solo lugar.
          </h1>
          <p className="max-w-[440px] text-base font-medium leading-[1.5] text-[#E6FFF5]">
            Solicitudes, clientes, préstamos, contabilidad y reportes — gestionados desde un panel
            directo y operativo.
          </p>
        </div>

        <span className="text-xs font-semibold tracking-[0.4px] text-white/60">
          © 2026 Mikro S.R.L.
        </span>
      </div>

      {/* Form side */}
      <div className="flex flex-1 items-center justify-center bg-ds-surface p-12">
        <form onSubmit={onSubmit} className="flex w-[392px] flex-col gap-[22px]">
          <div className="flex flex-col gap-2">
            <h2 className="text-[28px] font-bold tracking-[-0.5px] text-brand-ink">
              Inicia sesión
            </h2>
            <p className="text-[15px] font-medium leading-[1.4] text-ds-muted">
              Accede al panel de operaciones de Mikro.
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <Field
              label="Teléfono"
              icon={Phone}
              type="tel"
              autoComplete="username"
              placeholder="+18091234567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
            <Field
              label="Contraseña"
              icon={Lock}
              type="password"
              autoComplete="current-password"
              placeholder="••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-[13px] font-medium text-ds-muted">
              <input
                type="checkbox"
                className="h-[18px] w-[18px] rounded-[5px] border-[1.5px] border-ds-border accent-brand-blue-primary"
              />
              Recordarme
            </label>
            <button
              type="button"
              className="text-[13px] font-semibold text-brand-blue-primary hover:underline"
            >
              ¿Olvidaste tu contraseña?
            </button>
          </div>

          {login.isError && (
            <p className="text-[13px] text-ds-red" role="alert">
              Teléfono o contraseña inválidos.
            </p>
          )}

          <Button
            type="submit"
            block
            icon={ArrowRight}
            disabled={login.isPending}
            className="py-[13px]"
          >
            {login.isPending ? "Entrando…" : "Iniciar sesión"}
          </Button>
        </form>
      </div>
    </div>
  );
}
