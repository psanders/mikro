/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { useState } from "react";
import { Download, Check, X } from "lucide-react";
import { Nav } from "../components/Nav";
import { Footer } from "../components/Footer";

const asset = (file: string) => `${import.meta.env.BASE_URL}brand/${file}`;

const CHECKER: React.CSSProperties = {
  backgroundColor: "#FFFFFF",
  backgroundImage:
    "linear-gradient(45deg,#eef2f8 25%,transparent 25%),linear-gradient(-45deg,#eef2f8 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#eef2f8 75%),linear-gradient(-45deg,transparent 75%,#eef2f8 75%)",
  backgroundSize: "18px 18px",
  backgroundPosition: "0 0,0 9px,9px -9px,-9px 0"
};

type Logo = {
  name: string;
  desc: string;
  file: string;
  imgMaxH: string;
  swatch: "checker" | "dark" | "creative";
  tag?: string;
};

const LOGOS: Logo[] = [
  {
    name: "Logo principal",
    desc: "Lockup a color, para fondos claros con suficiente contraste.",
    file: "mikro-logo-principal",
    imgMaxH: "max-h-16",
    swatch: "checker"
  },
  {
    name: "Sobre fondo oscuro",
    desc: "Versión clara para degradados de marca o fondos de bajo brillo.",
    file: "mikro-logo-oscuro",
    imgMaxH: "max-h-16",
    swatch: "dark"
  },
  {
    name: "Isotipo",
    desc: "Solo el mark, para favicons, avatares de app e íconos.",
    file: "mikro-isotipo",
    imgMaxH: "max-h-[84px]",
    swatch: "checker"
  },
  {
    name: "Versión expresiva",
    desc: "Para camisetas, gorras, stickers y campañas. Nunca sustituye al lockup principal.",
    file: "mikro-mark-expresivo",
    imgMaxH: "max-h-[150px]",
    swatch: "creative",
    tag: "Merch"
  }
];

const COLOR_GROUPS: { title: string; colors: { name: string; hex: string }[] }[] = [
  {
    title: "Azules de marca",
    colors: [
      { name: "Deep Blue", hex: "#103A8A" },
      { name: "Blue Primary", hex: "#1F4AA8" },
      { name: "Sky Blue", hex: "#3F86E0" },
      { name: "Mist", hex: "#E9F2FF" }
    ]
  },
  {
    title: "Acento",
    colors: [
      { name: "Action Orange", hex: "#F68A1F" },
      { name: "Orange Deep", hex: "#E85B1C" },
      { name: "Sun Yellow", hex: "#FFD447" }
    ]
  },
  {
    title: "Neutros",
    colors: [
      { name: "Ink", hex: "#14254A" },
      { name: "White", hex: "#FFFFFF" },
      { name: "Background", hex: "#F4F7FB" },
      { name: "Border", hex: "#E5EAF1" },
      { name: "Muted", hex: "#697A93" }
    ]
  }
];

const USAGE_YES = [
  "Usar el lockup a todo color sobre fondos claros o con contraste suficiente",
  "Dejar un espacio de resguardo igual a la mitad de la altura del isotipo",
  "Usar la versión clara sobre fondos oscuros o degradados de marca"
];
const USAGE_NO = [
  "Estirar, recolorear con tonos ajenos a la paleta o apretar el isotipo",
  "Colocar el isotipo sobre fondos de bajo contraste",
  "Reconstruir el wordmark con otra tipografía"
];

function DownloadButton({ href, label, name }: { href: string; label: string; name: string }) {
  return (
    <a
      href={href}
      download={name}
      className="inline-flex h-[34px] flex-shrink-0 items-center gap-1.5 rounded-[9px] bg-brand-mist px-3 text-xs font-bold text-brand-blue-primary transition-colors hover:bg-[#d9e8fc]"
    >
      <Download className="h-4 w-4" strokeWidth={2.2} />
      {label}
    </a>
  );
}

const KIT_HREF = () => asset("mikro-brand-kit.zip");

export function BrandPage() {
  const [copied, setCopied] = useState<string | null>(null);

  function copyHex(hex: string) {
    navigator.clipboard?.writeText(hex).catch(() => {});
    setCopied(hex);
    setTimeout(() => setCopied((c) => (c === hex ? null : c)), 900);
  }

  return (
    <div className="bg-[#F4F7FB] text-brand-ink">
      <Nav />

      <div className="mx-auto max-w-[1120px] px-6">
        {/* Intro */}
        <header className="pt-16 pb-13 md:pt-16 md:pb-14">
          <p className="mb-3.5 text-[13px] font-bold uppercase tracking-[1.5px] text-brand-orange-deep">
            Marca / Brand kit
          </p>
          <h1 className="mb-[18px] max-w-[760px] text-4xl font-bold leading-[1.08] tracking-[-1px] text-brand-blue-deep md:text-[44px]">
            Logotipos, colores y tipografía de Mikro
          </h1>
          <p className="mb-7 max-w-[620px] text-lg font-medium leading-[1.55] text-[#697A93]">
            Descárgalos para usarlos en artículos, integraciones y materiales sobre el producto.
            Cada asset respeta la paleta y el lockup oficiales — evita recrearlos a mano.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <a
              href={KIT_HREF()}
              download="mikro-brand-kit.zip"
              className="inline-flex items-center gap-2.5 rounded-xl bg-brand-blue-deep px-[22px] py-[13px] text-[15px] font-semibold text-white transition-colors hover:bg-brand-blue-primary"
            >
              <Download className="h-[18px] w-[18px]" strokeWidth={2.2} />
              Descargar kit completo
            </a>
            <span className="text-[13px] font-medium text-[#697A93]">
              .zip · logos SVG + PNG · marca expresiva · paleta
            </span>
          </div>
        </header>

        {/* Logotipo */}
        <section className="border-t border-[#E5EAF1] py-14">
          <div className="mb-8">
            <p className="mb-2 text-[13px] font-bold uppercase tracking-[2px] text-brand-blue-primary">
              Logotipo
            </p>
            <h2 className="text-[28px] font-bold tracking-[-0.5px] text-brand-blue-deep">
              Cuatro expresiones, un mismo mark
            </h2>
            <p className="mt-1.5 max-w-[600px] text-[15px] font-medium text-[#697A93]">
              SVG y PNG del lockup completo, la versión clara y el isotipo — más la variante
              expresiva para merch y campañas.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {LOGOS.map((logo) => (
              <div
                key={logo.file}
                className="flex flex-col overflow-hidden rounded-2xl border border-[#E5EAF1] bg-white"
              >
                <div
                  className="flex h-[200px] items-center justify-center p-6"
                  style={
                    logo.swatch === "checker"
                      ? CHECKER
                      : logo.swatch === "dark"
                        ? { background: "linear-gradient(120deg,#103A8A,#1F4AA8)" }
                        : { background: "radial-gradient(circle at 32% 22%,#eef4ff,#FFFFFF 72%)" }
                  }
                >
                  <img
                    src={asset(`${logo.file}.svg`)}
                    alt={logo.name}
                    className={`w-auto ${logo.imgMaxH}`}
                  />
                </div>
                <div className="flex items-start justify-between gap-3 border-t border-[#E5EAF1] px-5 pb-5 pt-[18px]">
                  <div>
                    <h3 className="mb-1 flex items-center gap-2 text-base font-bold text-brand-ink">
                      {logo.name}
                      {logo.tag && (
                        <span className="rounded-[9px] bg-[#FDF1E3] px-[9px] py-1 text-[11px] font-bold uppercase tracking-[0.5px] text-brand-orange-deep">
                          {logo.tag}
                        </span>
                      )}
                    </h3>
                    <p className="text-[13px] font-medium leading-[1.45] text-[#697A93]">
                      {logo.desc}
                    </p>
                  </div>
                  <div className="flex flex-shrink-0 gap-2">
                    <DownloadButton
                      href={asset(`${logo.file}.svg`)}
                      label="SVG"
                      name={`${logo.file}.svg`}
                    />
                    <DownloadButton
                      href={asset(`${logo.file}.png`)}
                      label="PNG"
                      name={`${logo.file}.png`}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Color */}
        <section className="border-t border-[#E5EAF1] py-14">
          <div className="mb-8">
            <p className="mb-2 text-[13px] font-bold uppercase tracking-[2px] text-brand-blue-primary">
              Color
            </p>
            <h2 className="text-[28px] font-bold tracking-[-0.5px] text-brand-blue-deep">
              Paleta de marca
            </h2>
            <p className="mt-1.5 text-[15px] font-medium text-[#697A93]">
              Toca un color para copiar su hexadecimal.
            </p>
          </div>

          {COLOR_GROUPS.map((group) => (
            <div key={group.title} className="mb-8 last:mb-0">
              <h4 className="mb-3 text-[13px] font-bold uppercase tracking-[1px] text-[#697A93]">
                {group.title}
              </h4>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3.5">
                {group.colors.map((color) => (
                  <button
                    key={color.hex}
                    type="button"
                    onClick={() => copyHex(color.hex)}
                    className="relative overflow-hidden rounded-2xl border border-[#E5EAF1] bg-white text-left"
                  >
                    <div
                      className="h-[74px]"
                      style={{
                        background: color.hex,
                        border:
                          color.hex.toUpperCase() === "#FFFFFF" ? "1px solid #E5EAF1" : undefined
                      }}
                    />
                    <div className="px-3 pb-3 pt-2.5">
                      <p className="mb-0.5 text-[13px] font-bold text-brand-ink">{color.name}</p>
                      <p className="font-mono text-xs font-semibold text-[#697A93]">{color.hex}</p>
                    </div>
                    <div
                      className={`absolute inset-0 flex items-center justify-center bg-brand-blue-deep/95 text-[13px] font-bold text-white transition-opacity ${
                        copied === color.hex ? "opacity-100" : "pointer-events-none opacity-0"
                      }`}
                    >
                      Copiado
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </section>

        {/* Tipografía */}
        <section className="border-t border-[#E5EAF1] py-14">
          <div className="mb-8">
            <p className="mb-2 text-[13px] font-bold uppercase tracking-[2px] text-brand-blue-primary">
              Tipografía
            </p>
            <h2 className="text-[28px] font-bold tracking-[-0.5px] text-brand-blue-deep">Geist</h2>
            <p className="mt-1.5 max-w-[600px] text-[15px] font-medium text-[#697A93]">
              Limpia, geométrica y diseñada para pantallas. La misma fuente del sitio y el producto.
            </p>
          </div>
          <div className="rounded-2xl border border-[#E5EAF1] bg-white p-8">
            <div className="flex flex-wrap items-baseline justify-between gap-6 border-b border-[#E5EAF1] py-[18px]">
              <span className="w-[150px] flex-shrink-0 text-xs font-bold uppercase tracking-[0.5px] text-[#697A93]">
                Titular
              </span>
              <span className="text-[40px] font-bold tracking-[-1px] text-brand-blue-deep">
                Crédito rápido
              </span>
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-6 border-b border-[#E5EAF1] py-[18px]">
              <span className="w-[150px] flex-shrink-0 text-xs font-bold uppercase tracking-[0.5px] text-[#697A93]">
                Subtitular
              </span>
              <span className="text-[22px] font-medium text-brand-blue-deep">
                Evaluado con inteligencia
              </span>
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-6 border-b border-[#E5EAF1] py-[18px]">
              <span className="w-[150px] flex-shrink-0 text-xs font-bold uppercase tracking-[0.5px] text-[#697A93]">
                Cuerpo
              </span>
              <span className="text-base font-normal text-brand-ink">
                Solicitudes, clientes y préstamos gestionados desde un panel directo.
              </span>
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-6 py-[18px]">
              <span className="w-[150px] flex-shrink-0 text-xs font-bold uppercase tracking-[0.5px] text-[#697A93]">
                Botón / CTA
              </span>
              <span className="text-[15px] font-bold text-brand-orange-deep">
                Solicitar préstamo
              </span>
            </div>
            <div className="mt-6 flex flex-wrap gap-2.5">
              {[
                { label: "Regular 400", weight: "font-normal" },
                { label: "Medium 500", weight: "font-medium" },
                { label: "SemiBold 600", weight: "font-semibold" },
                { label: "Bold 700", weight: "font-bold" }
              ].map((w) => (
                <span
                  key={w.label}
                  className={`rounded-full border border-[#E5EAF1] bg-brand-mist px-4 py-2 text-sm text-brand-ink ${w.weight}`}
                >
                  {w.label}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Uso */}
        <section className="border-t border-[#E5EAF1] py-14">
          <div className="mb-8">
            <p className="mb-2 text-[13px] font-bold uppercase tracking-[2px] text-brand-blue-primary">
              Uso
            </p>
            <h2 className="text-[28px] font-bold tracking-[-0.5px] text-brand-blue-deep">
              Cómo aplicar el logo
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div className="rounded-2xl border border-[#CFEFDA] bg-[#E8F7EE] p-6">
              <h3 className="mb-3.5 text-[15px] font-bold text-[#16743A]">Sí</h3>
              <ul className="flex flex-col gap-3">
                {USAGE_YES.map((t) => (
                  <li
                    key={t}
                    className="flex gap-2.5 text-sm font-medium leading-[1.5] text-brand-ink"
                  >
                    <Check
                      className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#16743A]"
                      strokeWidth={2.6}
                    />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-[#F6D4D4] bg-[#FCEBEB] p-6">
              <h3 className="mb-3.5 text-[15px] font-bold text-[#B4231F]">No</h3>
              <ul className="flex flex-col gap-3">
                {USAGE_NO.map((t) => (
                  <li
                    key={t}
                    className="flex gap-2.5 text-sm font-medium leading-[1.5] text-brand-ink"
                  >
                    <X className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#B4231F]" strokeWidth={2.6} />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Voz y tono */}
        <section className="border-t border-[#E5EAF1] py-14">
          <div className="mb-8">
            <p className="mb-2 text-[13px] font-bold uppercase tracking-[2px] text-brand-blue-primary">
              Voz y tono
            </p>
            <h2 className="text-[28px] font-bold tracking-[-0.5px] text-brand-blue-deep">
              Cómo suena Mikro
            </h2>
          </div>
          <div
            className="grid grid-cols-1 gap-10 rounded-[20px] p-7 text-white md:grid-cols-[1.1fr_1fr] md:p-10"
            style={{ background: "linear-gradient(120deg,#103A8A,#1F4AA8)" }}
          >
            <p className="text-base font-medium leading-[1.6] text-[#DCE9FF]">
              Habla en frases cortas y motivadoras, en español. Prioriza beneficios, velocidad y
              certeza. Cada oración debe ser práctica y directa — sin jerga financiera ni lenguaje
              ambiguo.
            </p>
            <div>
              <div className="rounded-xl bg-white/[0.12] px-4 py-3.5 text-sm font-semibold">
                <span className="mb-1 block text-[11px] uppercase tracking-[1px] opacity-70">
                  Bien
                </span>
                “Empieza hoy. Paga semanal, sin complicaciones.”
              </div>
              <div className="mt-3 rounded-xl bg-brand-orange-deep/25 px-4 py-3.5 text-sm font-semibold text-[#FFD9C4]">
                <span className="mb-1 block text-[11px] uppercase tracking-[1px] opacity-70">
                  Evitar
                </span>
                Jerga financiera larga o lenguaje incierto.
              </div>
            </div>
          </div>
        </section>

        {/* Download CTA */}
        <section className="border-t border-[#E5EAF1] py-14">
          <div className="flex flex-wrap items-center justify-between gap-6 rounded-[20px] border border-[#E5EAF1] bg-white px-10 py-9">
            <div>
              <h3 className="mb-1.5 text-xl font-bold text-brand-blue-deep">
                ¿Listo para usar la marca?
              </h3>
              <p className="text-sm font-medium text-[#697A93]">
                Logos en SVG y PNG, marca expresiva para merch y la paleta completa, en un solo
                archivo.
              </p>
            </div>
            <a
              href={KIT_HREF()}
              download="mikro-brand-kit.zip"
              className="inline-flex items-center gap-2.5 rounded-xl bg-brand-blue-deep px-[22px] py-[13px] text-[15px] font-semibold text-white transition-colors hover:bg-brand-blue-primary"
            >
              <Download className="h-[18px] w-[18px]" strokeWidth={2.2} />
              Descargar kit completo
            </a>
          </div>
        </section>
      </div>

      <Footer />
    </div>
  );
}
