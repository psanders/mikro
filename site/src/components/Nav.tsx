/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { Link } from "react-router-dom";
import { Menu } from "lucide-react";
import { Logo } from "./Logo";
import { PrimaryButton } from "./PrimaryButton";

const NAV_LINKS = [
  { label: "Préstamos", to: "/solicitud" },
  { label: "Cómo funciona", to: "/#como-funciona" },
  { label: "Quiénes somos", to: "/#quienes-somos" },
  { label: "Soporte", to: "/faq" }
] as const;

export function Nav() {
  return (
    <header className="sticky top-0 z-50 border-b border-[#E6EEFB] bg-white">
      <nav className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-5 md:h-20 md:px-[60px]">
        <Link to="/">
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
          aria-label="Abrir menú"
        >
          <Menu className="h-6 w-6" strokeWidth={2} />
        </button>
      </nav>
    </header>
  );
}
