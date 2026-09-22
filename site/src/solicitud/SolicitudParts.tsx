/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Pieces both solicitud layouts render identically: the result screens shown
 * after submitting, and the buró consent + submit block.
 */
import { ArrowRight, Check, Clock, Loader2, MapPin } from "lucide-react";
import { Nav } from "../components/Nav";
import { Footer } from "../components/Footer";

function ResultScreen({
  icon,
  title,
  body
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="min-h-screen bg-brand-white font-sans text-brand-ink selection:bg-brand-blue-sky/30">
      <Nav />
      <section className="flex flex-col items-center justify-center gap-6 px-6 py-24 md:py-40">
        {icon}
        <h1 className="text-center text-3xl font-bold tracking-[-1px] text-brand-blue-deep md:text-[44px]">
          {title}
        </h1>
        <p className="max-w-[540px] text-center text-[17px] font-medium leading-[1.45] text-[#3C4F7A]">
          {body}
        </p>
      </section>
      <Footer />
    </div>
  );
}

export function SolicitudSuccess() {
  return (
    <ResultScreen
      icon={
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#D6F3E5]">
          <Check className="h-8 w-8 text-[#0E7C5F]" strokeWidth={2.5} />
        </div>
      }
      title="Solicitud enviada"
      body="Recibirás una respuesta en menos de 24 horas. Si tienes preguntas, escríbenos por WhatsApp."
    />
  );
}

/** Shown when the apiserver auto-rejected the application for its province. */
export function SolicitudOutOfArea() {
  return (
    <ResultScreen
      icon={
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#FFF1DC]">
          <MapPin className="h-8 w-8 text-brand-orange-deep" strokeWidth={2.25} />
        </div>
      }
      title="Aún no llegamos a tu ciudad"
      body="Lo sentimos, por el momento no estamos disponibles en tu ciudad. Estamos creciendo: vuelve a consultar en unos meses."
    />
  );
}

interface ConsentAndSubmitProps {
  agreed: boolean;
  onToggleAgreed: () => void;
  submitting: boolean;
  error: string;
  /** Extra control rendered before the submit button (the stepper's "Anterior"). */
  leading?: React.ReactNode;
}

/** Buró consent checkbox, error line, and the "Enviar solicitud" submit button. */
export function ConsentAndSubmit({
  agreed,
  onToggleAgreed,
  submitting,
  error,
  leading
}: ConsentAndSubmitProps) {
  return (
    <div className="flex flex-col gap-[22px]">
      <label className="flex cursor-pointer items-center gap-3" onClick={onToggleAgreed}>
        <span
          className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md ${
            agreed ? "bg-brand-blue-primary" : "border-[1.5px] border-[#E6EEFB] bg-white"
          }`}
        >
          {agreed && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
        </span>
        <span className="text-[13px] font-medium leading-[1.5] text-[#5B6B8C]">
          Autorizo a Mikro Crédito a consultar y reportar mi información en el buró de crédito para
          evaluar esta solicitud.
        </span>
      </label>

      {error && <p className="text-sm font-medium text-red-600">{error}</p>}

      {/* With a `leading` control (the stepper's "Anterior") the primary button
          goes first on mobile, matching the stepper's other steps. */}
      <div
        className={`flex items-stretch gap-4 md:flex-row md:items-center md:justify-between ${
          leading ? "flex-col-reverse" : "flex-col"
        }`}
      >
        {leading ?? (
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 shrink-0 text-brand-blue-primary" strokeWidth={2} />
            <span className="text-sm font-medium text-[#5B6B8C]">
              Respuesta en menos de 24 horas.
            </span>
          </div>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center justify-center gap-2.5 rounded-[14px] bg-brand-orange-primary px-7 py-[18px] text-[17px] font-semibold text-white transition-colors duration-200 hover:bg-[#ff9f4a] active:bg-[#e67d10] disabled:opacity-60"
        >
          {submitting ? (
            <>
              <Loader2 className="h-[18px] w-[18px] animate-spin" strokeWidth={2} />
              Enviando...
            </>
          ) : (
            <>
              Enviar solicitud
              <ArrowRight className="h-[18px] w-[18px]" strokeWidth={2} />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
