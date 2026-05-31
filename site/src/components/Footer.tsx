/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { Link } from "react-router-dom";
import { Logo } from "./Logo";
import { FacebookIcon, InstagramIcon, LinkedinIcon, YoutubeIcon } from "./SocialIcons";

const SOCIAL = [
  { icon: InstagramIcon, label: "Instagram" },
  { icon: FacebookIcon, label: "Facebook" },
  { icon: LinkedinIcon, label: "LinkedIn" },
  { icon: YoutubeIcon, label: "YouTube" }
] as const;

const PRODUCT_LINKS = [
  { label: "Solicitar préstamo", to: "/solicitud" },
  { label: "Cómo funciona", to: "/#como-funciona" },
  { label: "Preguntas frecuentes", to: "/faq" }
] as const;

const LEGAL_LINKS = [
  { label: "WhatsApp", href: "https://wa.me/18493547577" },
  { label: "Términos y condiciones", to: "/terminos" },
  { label: "Aviso de privacidad", to: "/privacidad" }
] as const;

export function Footer() {
  return (
    <footer className="bg-brand-ink text-[#A8C0E8]">
      <div className="mx-auto max-w-[1440px] px-6 py-10 md:px-[60px] md:pb-10 md:pt-14">
        {/* Desktop layout */}
        <div className="hidden gap-16 md:flex md:justify-between">
          <div className="max-w-[420px] shrink-0">
            <Link to="/">
              <Logo inverted />
            </Link>
            <p className="mt-[18px] text-sm font-medium leading-[1.5]">
              Crédito rápido, evaluado con inteligencia y aprobado por personas reales.
            </p>
            <div className="mt-[18px] flex gap-2.5">
              {SOCIAL.map(({ icon: Icon, label }) => (
                <a
                  key={label}
                  href="#"
                  aria-label={label}
                  className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#1A2D58] text-white transition-colors hover:bg-[#243a6e]"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          <div className="flex gap-16">
            <div>
              <p className="text-[13px] font-semibold tracking-[1.5px] text-white">Producto</p>
              <ul className="mt-3.5 flex flex-col gap-3.5">
                {PRODUCT_LINKS.map((item) => (
                  <li key={item.label}>
                    <Link to={item.to} className="text-sm font-medium hover:text-white">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-[13px] font-semibold tracking-[1.5px] text-white">
                Soporte y legal
              </p>
              <ul className="mt-3.5 flex flex-col gap-3.5">
                {LEGAL_LINKS.map((item) => (
                  <li key={item.label}>
                    {"href" in item ? (
                      <a
                        href={item.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium hover:text-white"
                      >
                        {item.label}
                      </a>
                    ) : (
                      <Link to={item.to} className="text-sm font-medium hover:text-white">
                        {item.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Mobile layout */}
        <div className="flex flex-col gap-[18px] md:hidden">
          <div className="flex items-center justify-between">
            <Link to="/">
              <Logo inverted compact />
            </Link>
            <div className="flex gap-2.5">
              {SOCIAL.map(({ icon: Icon, label }) => (
                <a
                  key={label}
                  href="#"
                  aria-label={label}
                  className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#1A2D58] text-white"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>
          <p className="text-[13px] font-medium leading-[1.5]">
            Crédito rápido, evaluado con inteligencia y aprobado por personas reales.
          </p>
          <div className="flex justify-between gap-5 pt-1.5">
            <div>
              <p className="text-[13px] font-semibold tracking-[1.5px] text-white">Producto</p>
              <ul className="mt-3.5 flex flex-col gap-3.5">
                {PRODUCT_LINKS.map((item) => (
                  <li key={item.label}>
                    <Link to={item.to} className="text-sm font-medium">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-[13px] font-semibold tracking-[1.5px] text-white">
                Soporte y legal
              </p>
              <ul className="mt-3.5 flex flex-col gap-3.5">
                {LEGAL_LINKS.map((item) => (
                  <li key={item.label}>
                    {"href" in item ? (
                      <a
                        href={item.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium"
                      >
                        {item.label}
                      </a>
                    ) : (
                      <Link to={item.to} className="text-sm font-medium">
                        {item.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-8 h-px w-full bg-[#1A2D58] md:mt-8" />

        <div className="mt-6 flex flex-col gap-3 text-[13px] font-medium md:flex-row md:items-center md:justify-between md:gap-6">
          <p>© 2026 Mikro, S.R.L · Santo Domingo, RD</p>
          <p className="md:text-right">RNC 1-33-61735-8 · No somos un banco, y eso es bueno.</p>
        </div>
      </div>
    </footer>
  );
}
