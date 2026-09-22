/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * The original accordion solicitud, all five sections on one page. Kept at
 * /solicitud-v0 so we can compare it with (or revert to it from) the stepper
 * that replaced it at /solicitud. Shares its fields, autosave, submit and
 * result screens with the stepper via ../solicitud.
 */
import { useState, type FormEvent } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
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

export function SolicitudV0Page() {
  const [openSection, setOpenSection] = useState("personal");
  const { form, set, agreed, setAgreed, submitting, outcome, error, leaveSection, submit } =
    useSolicitud(openSection);

  const handleToggle = (sectionId: string) => {
    leaveSection(openSection);
    setOpenSection(openSection === sectionId ? "" : sectionId);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    void submit();
  };

  if (outcome === "success") return <SolicitudSuccess />;
  if (outcome === "out_of_area") return <SolicitudOutOfArea />;

  return (
    <div className="min-h-screen bg-brand-white font-sans text-brand-ink selection:bg-brand-blue-sky/30">
      <Nav />

      {/* Header */}
      <section className="bg-[linear-gradient(160deg,#103A8A_0%,#3F86E0_100%)] px-6 py-10 md:px-[60px] md:py-16">
        <div className="mx-auto flex max-w-[1440px] flex-col items-center gap-4 md:gap-[18px]">
          <div className="flex items-center gap-2.5 rounded-full border border-[#3F86E055] bg-[#1A4FB2] px-3.5 py-2">
            <span className="text-xs font-medium text-[#D8E8FF] md:text-[13px]">
              Solicitud de crédito · Paso único
            </span>
          </div>
          <h1 className="text-center text-3xl font-bold leading-[1.1] tracking-[-1.2px] text-white md:text-[44px]">
            Cuéntanos sobre ti
          </h1>
          <p className="max-w-[720px] text-center text-[15px] font-medium leading-[1.45] text-[#D8E8FF] md:text-[17px]">
            Estos datos nos permiten evaluar tu solicitud de forma justa y rápida. Toma menos de 5
            minutos y tu información viaja cifrada y protegida.
          </p>
        </div>
      </section>

      {/* Form Body */}
      <section className="bg-brand-mist px-5 py-8 md:px-[60px] md:py-16 md:pb-20">
        <form onSubmit={handleSubmit} className="mx-auto flex max-w-[880px] flex-col gap-6">
          {SECTION_DEFS.map((section) => {
            const isOpen = openSection === section.id;
            const Icon = section.icon;

            return (
              <div
                key={section.id}
                className={`rounded-[20px] bg-white ${
                  isOpen
                    ? "border-2 border-brand-blue-sky p-6 md:p-8"
                    : "border-[1.5px] border-[#E6EEFB] px-6 py-[22px] md:px-8"
                }`}
              >
                <button
                  type="button"
                  onClick={() => handleToggle(section.id)}
                  className="flex w-full items-center gap-4"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-brand-mist">
                    <Icon className="h-[22px] w-[22px] text-brand-blue-primary" strokeWidth={2} />
                  </div>
                  <div className="flex flex-1 flex-col items-start gap-0.5">
                    <span className="text-left text-base font-bold tracking-[-0.3px] text-brand-ink md:text-[19px]">
                      {section.num} &nbsp;·&nbsp; {section.title}
                    </span>
                    <span className="text-left text-[13px] font-medium text-[#5B6B8C] md:text-sm">
                      {section.subtitle}
                    </span>
                  </div>
                  {isOpen ? (
                    <ChevronUp
                      className="h-5 w-5 shrink-0 text-brand-blue-primary"
                      strokeWidth={2}
                    />
                  ) : (
                    <ChevronDown
                      className="h-5 w-5 shrink-0 text-brand-blue-primary"
                      strokeWidth={2}
                    />
                  )}
                </button>

                {isOpen && (
                  <div className="mt-6 flex flex-col gap-[18px]">
                    <SectionFields sectionId={section.id} form={form} onChange={set} />
                  </div>
                )}
              </div>
            );
          })}

          {/* Submit Section */}
          <div className="rounded-[20px] border-[1.5px] border-[#E6EEFB] bg-white p-6 md:p-8">
            <ConsentAndSubmit
              agreed={agreed}
              onToggleAgreed={() => setAgreed(!agreed)}
              submitting={submitting}
              error={error}
            />
          </div>
        </form>
      </section>

      <Footer />
    </div>
  );
}
