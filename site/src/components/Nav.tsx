/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { Logo } from "./Logo";
import { PrimaryButton } from "./PrimaryButton";

const NAV_LINKS = [
  { label: "Préstamos", to: "/solicitud" },
  { label: "Cómo funciona", to: "/#como-funciona" },
  { label: "Quiénes somos", to: "/#quienes-somos" },
  { label: "Soporte", to: "/faq" }
] as const;

export function Nav() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  function close() {
    setOpen(false);
  }

  return (
    <header className="sticky top-0 z-50 border-b border-[#E6EEFB] bg-white">
      <nav className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-5 md:h-20 md:px-[60px]">
        <Link to="/" onClick={close}>
          <Logo />
        </Link>

        <div className="hidden items-center gap-9 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.label}
              to={link.to}
              className="text-[15px] font-medium text-brand-ink transition-colors hover:text-brand-blue-deep"
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="hidden md:block">
          <PrimaryButton as={Link} to="/solicitud" size="nav">
            Solicitar préstamo
          </PrimaryButton>
        </div>

        <button
          type="button"
          className="p-2 text-brand-blue-deep md:hidden"
          onClick={() => setOpen(!open)}
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={open}
        >
          {open ? (
            <X className="h-6 w-6" strokeWidth={2} />
          ) : (
            <Menu className="h-6 w-6" strokeWidth={2} />
          )}
        </button>
      </nav>

      {open && (
        <div className="border-t border-[#E6EEFB] bg-white px-5 pb-5 md:hidden">
          <div className="flex flex-col gap-1 pt-2">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.label}
                to={link.to}
                onClick={close}
                className={`rounded-lg px-3 py-2.5 text-[15px] font-medium transition-colors ${
                  location.pathname === link.to
                    ? "bg-brand-mist text-brand-blue-primary"
                    : "text-brand-ink hover:bg-brand-mist/50"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>
          <div className="mt-3">
            <PrimaryButton as={Link} to="/solicitud" onClick={close} className="w-full">
              Solicitar préstamo
            </PrimaryButton>
          </div>
        </div>
      )}
    </header>
  );
}
