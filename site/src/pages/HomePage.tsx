/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { Link } from "react-router-dom";
import { Timer, MapPin, UserCheck, ArrowRight, ArrowUpRight } from "lucide-react";
import { Nav } from "../components/Nav";
import { Footer } from "../components/Footer";
import { Simulator } from "../components/Simulator";
import { PrimaryButton } from "../components/PrimaryButton";
import { SecondaryButton } from "../components/SecondaryButton";

const DESIGNED_FOR_DESKTOP = [
  "COLMADOS",
  "TALLERS",
  "SALONES_DE_BELLEZA",
  "COMIDA RÁPIDA",
  "FERRETERÍAS"
] as const;

const DESIGNED_FOR_MOBILE = ["COLMADOS", "SALONES", "TALLERES"] as const;

const FEATURES = [
  {
    icon: UserCheck,
    iconBg: "bg-[#FFE7D6]",
    iconColor: "text-brand-orange-deep",
    title: "Personas que deciden",
    desc: "Un oficial revisa y firma. Sin auto-rechazos."
  },
  {
    icon: Timer,
    iconBg: "bg-[#D6F3E5]",
    iconColor: "text-[#0E7C5F]",
    title: "Decisión en hasta 24h",
    desc: "La mayoría se resuelve el mismo día."
  },
  {
    icon: MapPin,
    iconBg: "bg-[#EDE3FF]",
    iconColor: "text-[#7C3AED]",
    title: "Te visitamos donde estés",
    desc: "Firmamos en persona, sin costo adicional."
  }
] as const;

const STEPS = [
  {
    num: "01",
    title: "Solicitas en 3 minutos",
    desc: "Llenas un formulario corto desde tu teléfono. Te identificas con tu cédula y autorizas la consulta al bureau."
  },
  {
    num: "02",
    title: "Evaluamos con inteligencia y criterio",
    desc: "Recibes una pre-evaluación en segundos. Si tu caso lo amerita, un oficial te llama o te visita para entender mejor tu situación."
  },
  {
    num: "03",
    title: "Recibes el dinero en hasta 24h",
    desc: "Firmas digital o en persona, y el dinero entra a tu cuenta — o te lo entrega un oficial donde estés."
  }
] as const;

const STATS = [
  { value: "<24h", label: "decisión promedio" },
  { value: "+100", label: "clientes activos" },
  { value: "4.8★", label: "satisfacción" }
] as const;

export function HomePage() {
  return (
    <div className="min-h-screen bg-brand-white font-sans text-brand-ink selection:bg-brand-blue-sky/30">
      <Nav />

      {/* Hero */}
      <section className="relative overflow-x-clip bg-[linear-gradient(160deg,#103A8A_0%,#3F86E0_100%)]">
        <div className="mx-auto flex max-w-[1440px] flex-col items-stretch gap-10 px-6 py-10 md:flex-row md:items-center md:gap-[60px] md:px-20 md:py-20">
          <div className="flex w-full flex-1 flex-col items-stretch gap-7 text-left md:max-w-xl md:gap-7">
            <div className="flex w-fit self-start items-center gap-2.5 rounded-full border border-[#3F86E055] bg-[#1A4FB2] px-3.5 py-2">
              <div className="h-2 w-2 rounded-full bg-brand-yellow-accent" />
              <span className="text-[13px] font-medium text-[#D8E8FF] max-md:text-xs">
                Microcrédito · IA + criterio humano
              </span>
            </div>

            <h1 className="text-[38px] font-bold leading-[1.05] tracking-[-1px] text-white md:text-[60px] md:tracking-[-1.5px]">
              Crédito rápido, evaluado con inteligencia.
            </h1>

            <p className="text-base font-medium leading-[1.45] text-[#D8E8FF] md:text-[19px] max-md:hidden">
              Somos una financiera nativa de IA. Cruzamos el bureau, leemos tu historial real y
              dejamos la decisión final en manos de una persona — porque un mal mes no define a un
              buen cliente.
            </p>
            <p className="text-base font-medium leading-[1.45] text-[#D8E8FF] md:hidden">
              Cruzamos el bureau, leemos tu historial real y dejamos la decisión final en manos de
              una persona — porque un mal mes no define a un buen cliente.
            </p>

            <div className="flex w-full flex-col gap-3 pt-1 md:w-auto md:flex-row md:items-center md:gap-3.5 md:pt-3">
              <PrimaryButton as={Link} to="/solicitud" className="w-full md:w-auto">
                Solicitar mi préstamo
              </PrimaryButton>
              <SecondaryButton variant="calculator" className="w-full md:w-auto">
                Simular cuota
              </SecondaryButton>
            </div>

            <div className="flex w-full justify-between gap-4 pt-2 md:w-auto md:justify-start md:gap-10 md:pt-7">
              {STATS.map((stat) => (
                <div key={stat.label} className="flex flex-col items-start gap-1">
                  <span className="text-2xl font-bold tracking-[-0.5px] text-brand-yellow-accent md:text-[28px]">
                    {stat.value}
                  </span>
                  <span className="text-[11px] font-medium tracking-wide text-[#D8E8FF] md:text-[13px] md:tracking-[0.5px]">
                    {stat.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="w-full shrink-0 md:flex-1 md:pl-6 lg:pl-10 xl:pl-14">
            <Simulator />
          </div>
        </div>
      </section>

      {/* Trust */}
      <section className="bg-white px-6 py-7 md:px-20 md:py-9">
        <div className="mx-auto flex max-w-[1440px] flex-col items-center gap-3.5 md:flex-row md:justify-between md:gap-8">
          <span className="text-center text-[13px] font-medium tracking-wide text-[#5B6B8C] md:text-sm md:tracking-[0.5px]">
            Crédito diseñado para:
          </span>
          <div className="hidden flex-wrap items-center justify-center gap-9 md:flex">
            {DESIGNED_FOR_DESKTOP.map((item) => (
              <span key={item} className="text-sm font-semibold tracking-[1.5px] text-[#9AAACB]">
                {item}
              </span>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-[18px] md:hidden">
            {DESIGNED_FOR_MOBILE.map((item) => (
              <span key={item} className="text-[11px] font-semibold tracking-wide text-[#9AAACB]">
                {item}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Why */}
      <section className="bg-brand-mist px-6 py-10 md:px-[60px] md:py-12">
        <div className="mx-auto flex max-w-[1440px] flex-col md:flex-row md:items-center md:justify-between">
          {FEATURES.map((item, idx) => (
            <div key={item.title} className="contents">
              {idx > 0 && <div className="h-px w-full bg-[#DCE5F2] md:hidden" aria-hidden />}
              <div className="flex items-center gap-4 py-4 md:flex-1 md:gap-4 md:px-7 md:py-0 first:md:pl-0 last:md:pr-0">
                <div
                  className={`flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[14px] max-md:h-11 max-md:w-11 max-md:rounded-xl ${item.iconBg}`}
                >
                  <item.icon
                    className={`h-6 w-6 max-md:h-[22px] max-md:w-[22px] ${item.iconColor}`}
                    strokeWidth={2}
                  />
                </div>
                <div className="flex flex-col gap-0.5 md:gap-[3px]">
                  <h3 className="text-[17px] font-bold leading-[1.15] tracking-[-0.3px] text-brand-blue-deep md:text-[19px] md:tracking-[-0.4px]">
                    {item.title}
                  </h3>
                  <p className="text-[13px] font-medium leading-[1.4] text-[#3C4F7A] md:text-sm">
                    {item.desc}
                  </p>
                </div>
              </div>
              {idx < FEATURES.length - 1 && (
                <div className="hidden h-14 w-px shrink-0 bg-[#DCE5F2] md:block" aria-hidden />
              )}
            </div>
          ))}
        </div>
      </section>

      {/* How */}
      <section id="como-funciona" className="bg-white px-6 py-16 md:px-[60px] md:py-[100px]">
        <div className="mx-auto flex max-w-[1440px] flex-col items-center gap-12 md:gap-[60px]">
          <div className="flex flex-col items-center gap-4 text-center">
            <span className="rounded-full bg-[#D6F3E5] px-3.5 py-1.5 text-xs font-bold tracking-widest text-[#0E7C5F]">
              CÓMO FUNCIONA
            </span>
            <h2 className="max-w-[900px] text-3xl font-bold leading-[1.1] tracking-[-1px] text-brand-blue-deep md:text-[44px]">
              Tres pasos. Una sola conversación.
            </h2>
          </div>

          <div className="grid w-full grid-cols-1 gap-6 md:grid-cols-3 md:gap-6">
            {STEPS.map((step) => (
              <div
                key={step.num}
                className="flex flex-col gap-5 rounded-3xl bg-brand-mist p-9 md:gap-5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[56px] font-bold leading-none tracking-[-2px] text-brand-blue-sky">
                    {step.num}
                  </span>
                  <ArrowUpRight className="h-6 w-6 text-brand-blue-deep" strokeWidth={2} />
                </div>
                <h3 className="text-[22px] font-bold leading-[1.15] tracking-[-0.5px] text-brand-blue-deep">
                  {step.title}
                </h3>
                <p className="text-[15px] font-medium leading-relaxed text-[#3C4F7A]">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section
        id="quienes-somos"
        className="bg-[linear-gradient(180deg,#1F4AA8_0%,#103A8A_100%)] px-6 py-16 md:px-[60px] md:py-[100px]"
      >
        <div className="mx-auto flex max-w-[1000px] flex-col items-center gap-6 text-center md:gap-6">
          <h2 className="text-4xl font-bold leading-[1.1] tracking-[-1.2px] text-white md:text-[52px]">
            Tu próximo préstamo,
            <br className="hidden md:block" />
            sin dolores de cabeza.
          </h2>
          <p className="max-w-[780px] text-base font-medium leading-[1.45] text-[#D8E8FF] md:text-lg">
            <span className="md:hidden">
              Solicita en 3 minutos. Respuesta en hasta 24 horas. Atendido por personas reales.
            </span>
            <span className="hidden md:inline">
              Solicita en 3 minutos. Respuesta en menos de 24 horas. Atendido por personas reales.
            </span>
          </p>

          <div className="flex w-full flex-col gap-3.5 pt-2 md:w-auto md:flex-row md:items-center md:pt-5">
            <PrimaryButton as={Link} to="/solicitud" className="w-full md:w-auto">
              Solicitar préstamo
            </PrimaryButton>
            <SecondaryButton
              variant="whatsapp"
              href="https://wa.me/18493547577"
              className="w-full md:w-auto"
            >
              Hablar por WhatsApp
            </SecondaryButton>
          </div>

          <Link
            to="/faq"
            className="mt-1 flex items-center gap-2 text-sm font-medium text-[#D8E8FF] transition-colors hover:text-white md:text-[15px]"
          >
            <span className="md:hidden">Ver preguntas frecuentes</span>
            <span className="hidden md:inline">¿Más dudas? Lee las preguntas frecuentes</span>
            <ArrowRight className="h-4 w-4 max-md:h-[15px] max-md:w-[15px]" strokeWidth={2} />
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
