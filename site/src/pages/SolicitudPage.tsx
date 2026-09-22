/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * The solicitud as a stepper: one section per screen with visible progress,
 * replacing the all-at-once accordion (kept at /solicitud-v0) to cut the
 * number of applicants who open the form and leave. Same questions, same
 * grouping, same section icons — only the layout differs, and all behavior
 * (autosave, beacon, Meta events, submit, result screens) is shared.
 */
import { useRef, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { APPLICATION_SECTIONS } from "@mikro/application-form";
import { Nav } from "../components/Nav";
import { Footer } from "../components/Footer";
import { SECTION_DEFS } from "../solicitud/formConfig";
import { SectionFields } from "../solicitud/SectionFields";
import { useSolicitud } from "../solicitud/useSolicitud";
import {
  ConsentAndSubmit,
  SolicitudOutOfArea,
  SolicitudSuccess
} from "../solicitud/SolicitudParts";

const TOTAL_STEPS = SECTION_DEFS.length;

/** Required keys of a section that are still empty. */
function missingFields(sectionId: string, form: Record<string, string>): string[] {
  const section = APPLICATION_SECTIONS.find((s) => s.id === sectionId);
  if (!section) return [];
  return section.requiredFields.filter((key) => !(form[key] ?? "").trim());
}

interface StepIndicatorProps {
  step: number;
  maxReached: number;
  onJump: (index: number) => void;
}

/** Section icons joined by a track: done (filled), current (outlined), upcoming (muted). */
function StepIndicator({ step, maxReached, onJump }: StepIndicatorProps) {
  return (
    <ol className="flex items-center" aria-label="Progreso de la solicitud">
      {SECTION_DEFS.map((section, index) => {
        const Icon = section.icon;
        const done = index < step;
        const current = index === step;
        const reachable = index <= maxReached && !current;
        return (
          <li key={section.id} className={`flex items-center ${index > 0 ? "flex-1" : ""}`}>
            {index > 0 && (
              <span
                aria-hidden
                className={`mx-1.5 h-[3px] flex-1 rounded-full md:mx-2.5 ${
                  index <= step ? "bg-brand-blue-primary" : "bg-[#D5E3F7]"
                }`}
              />
            )}
            <button
              type="button"
              onClick={() => reachable && onJump(index)}
              disabled={!reachable}
              aria-current={current ? "step" : undefined}
              aria-label={`Paso ${index + 1}: ${section.title}`}
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors md:h-12 md:w-12 ${
                done
                  ? "bg-brand-blue-primary text-white"
                  : current
                    ? "border-2 border-brand-blue-primary bg-white text-brand-blue-primary"
                    : "bg-[#DCE8F8] text-[#7888A8]"
              } ${reachable ? "cursor-pointer hover:opacity-85" : "cursor-default"}`}
            >
              {done ? (
                <Check className="h-[18px] w-[18px] md:h-5 md:w-5" strokeWidth={2.5} />
              ) : (
                <Icon className="h-[18px] w-[18px] md:h-5 md:w-5" strokeWidth={2} />
              )}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

export function SolicitudPage() {
  const [step, setStep] = useState(0);
  const [maxReached, setMaxReached] = useState(0);
  const [invalid, setInvalid] = useState<Set<string>>(new Set());
  const section = SECTION_DEFS[step];
  const isLast = step === TOTAL_STEPS - 1;
  const cardRef = useRef<HTMLDivElement>(null);

  const {
    form,
    set,
    agreed,
    setAgreed,
    submitting,
    outcome,
    error,
    setError,
    leaveSection,
    submit
  } = useSolicitud(section.id);

  const goTo = (index: number) => {
    leaveSection(section.id);
    setInvalid(new Set());
    setError("");
    setStep(index);
    setMaxReached((prev) => Math.max(prev, index));
    cardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Validates the current step against the shared required-field list (not the
  // browser's `required`, which can't see steps that aren't on screen).
  const goNext = () => {
    const missing = missingFields(section.id, form);
    if (missing.length > 0) {
      setInvalid(new Set(missing));
      setError("Completa los campos marcados para continuar.");
      return;
    }
    goTo(step + 1);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    // Enter in a text input submits the form; before the last step that means "Siguiente".
    if (!isLast) {
      goNext();
      return;
    }
    const firstIncomplete = SECTION_DEFS.findIndex((s) => missingFields(s.id, form).length > 0);
    if (firstIncomplete !== -1) {
      if (firstIncomplete !== step) goTo(firstIncomplete);
      setInvalid(new Set(missingFields(SECTION_DEFS[firstIncomplete].id, form)));
      setError("Completa los campos marcados para continuar.");
      return;
    }
    void submit();
  };

  if (outcome === "success") return <SolicitudSuccess />;
  if (outcome === "out_of_area") return <SolicitudOutOfArea />;

  // Only flag fields that are still empty, so a flag clears as soon as it's answered.
  const stillInvalid = new Set([...invalid].filter((key) => !(form[key] ?? "").trim()));
  const Icon = section.icon;
  const percent = Math.round(((step + 1) / TOTAL_STEPS) * 100);

  return (
    <div className="min-h-screen bg-brand-white font-sans text-brand-ink selection:bg-brand-blue-sky/30">
      <Nav />

      {/* Header */}
      <section className="bg-[linear-gradient(160deg,#103A8A_0%,#3F86E0_100%)] px-6 py-8 md:px-[60px] md:py-12">
        <div className="mx-auto flex max-w-[1440px] flex-col items-center gap-3 md:gap-4">
          <div className="flex items-center gap-2.5 rounded-full border border-[#3F86E055] bg-[#1A4FB2] px-3.5 py-2">
            <span className="text-xs font-medium text-[#D8E8FF] md:text-[13px]">
              Solicitud de crédito · Menos de 5 minutos
            </span>
          </div>
          <h1 className="text-center text-3xl font-bold leading-[1.1] tracking-[-1.2px] text-white md:text-[44px]">
            Cuéntanos sobre ti
          </h1>
          <p className="max-w-[640px] text-center text-[15px] font-medium leading-[1.45] text-[#D8E8FF] md:text-[17px]">
            Cinco pasos cortos. Tu información viaja cifrada y protegida.
          </p>
        </div>
      </section>

      {/* Form Body */}
      <section className="bg-brand-mist px-5 py-8 md:px-[60px] md:py-14 md:pb-20">
        <form
          onSubmit={handleSubmit}
          // Validation is ours on every step (flags + message), never the browser popup.
          noValidate
          className="mx-auto flex max-w-[720px] flex-col gap-6"
        >
          {/* Progress */}
          <div className="flex flex-col gap-4">
            <StepIndicator step={step} maxReached={maxReached} onJump={goTo} />
            <div className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-bold text-brand-blue-deep">
                  Paso {step + 1} de {TOTAL_STEPS}
                </span>
                <span className="text-[13px] font-semibold text-[#5B6B8C]">{percent}%</span>
              </div>
              <div
                className="h-2 w-full overflow-hidden rounded-full bg-[#D5E3F7]"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={TOTAL_STEPS}
                aria-valuenow={step + 1}
              >
                <div
                  className="h-full rounded-full bg-brand-orange-primary transition-[width] duration-300"
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          </div>

          {/* Current section */}
          <div
            ref={cardRef}
            className="scroll-mt-24 rounded-[20px] border-2 border-brand-blue-sky bg-white p-6 md:p-8"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-brand-mist">
                <Icon className="h-[22px] w-[22px] text-brand-blue-primary" strokeWidth={2} />
              </div>
              <div className="flex flex-1 flex-col items-start gap-0.5">
                <h2 className="text-left text-base font-bold tracking-[-0.3px] text-brand-ink md:text-[19px]">
                  {section.num} &nbsp;·&nbsp; {section.title}
                </h2>
                <span className="text-left text-[13px] font-medium text-[#5B6B8C] md:text-sm">
                  {section.subtitle}
                </span>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-[18px]">
              <SectionFields
                sectionId={section.id}
                form={form}
                onChange={set}
                invalidFields={stillInvalid}
              />
            </div>

            <div className="mt-8 border-t border-[#E6EEFB] pt-6">
              {isLast ? (
                <ConsentAndSubmit
                  agreed={agreed}
                  onToggleAgreed={() => setAgreed(!agreed)}
                  submitting={submitting}
                  error={error}
                  leading={<BackButton onClick={() => goTo(step - 1)} />}
                />
              ) : (
                <div className="flex flex-col gap-4">
                  {error && <p className="text-sm font-medium text-red-600">{error}</p>}
                  <div className="flex flex-col-reverse items-stretch gap-3 md:flex-row md:items-center md:justify-between">
                    {step > 0 ? <BackButton onClick={() => goTo(step - 1)} /> : <span />}
                    <button
                      type="submit"
                      className="inline-flex items-center justify-center gap-2.5 rounded-[14px] bg-brand-orange-primary px-7 py-[18px] text-[17px] font-semibold text-white transition-colors duration-200 hover:bg-[#ff9f4a] active:bg-[#e67d10]"
                    >
                      Siguiente
                      <ArrowRight className="h-[18px] w-[18px]" strokeWidth={2} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </form>
      </section>

      <Footer />
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center justify-center gap-2 rounded-[14px] border-[1.5px] border-[#D5E3F7] bg-white px-6 py-4 text-[16px] font-semibold text-brand-blue-primary transition-colors duration-200 hover:bg-brand-mist"
    >
      <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={2} />
      Anterior
    </button>
  );
}
