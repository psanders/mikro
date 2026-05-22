/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Nav } from "../components/Nav";
import { Footer } from "../components/Footer";

const FAQ_ITEMS = [
  {
    question: "¿Qué necesito para solicitar?",
    answer:
      "Tu cédula vigente, evidencia de ingresos (cualquier formato — recibos, depósitos, ventas) y autorización para consultar tu bureau de crédito. Eso es todo."
  },
  {
    question: "¿En cuánto tiempo recibo el dinero?",
    answer:
      "Si tu solicitud es aprobada, normalmente recibes el dinero en hasta 24 horas — y en muchos casos, el mismo día."
  },
  {
    question: "¿Y si tengo mal crédito o nunca he tenido?",
    answer:
      "No te descartamos por un mal mes ni por falta de historial. Evaluamos tu situación completa y, si hace falta, un oficial conversa contigo antes de decidir."
  },
  {
    question: "¿Qué tasa voy a pagar?",
    answer:
      "Trabajamos con una tasa base transparente, sin cargos ocultos. La tasa final depende de tu evaluación y siempre se te muestra antes de firmar."
  },
  {
    question: "¿Cómo usan mis datos? ¿Es seguro?",
    answer:
      "Solo consultamos tu bureau con tu autorización y protegemos tu información bajo los estándares regulatorios vigentes. Nunca vendemos tus datos."
  }
] as const;

export function FAQPage() {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <div className="min-h-screen bg-brand-white font-sans text-brand-ink selection:bg-brand-blue-sky/30">
      <Nav />

      <section className="bg-white px-6 py-12 md:px-[60px] md:py-[100px]">
        <div className="mx-auto flex max-w-[1440px] flex-col items-center gap-6 md:gap-10">
          {/* Header */}
          <div className="flex flex-col items-center gap-3.5 md:gap-3.5">
            <span className="rounded-full bg-brand-mist px-3.5 py-1.5 text-xs font-semibold tracking-[2px] text-brand-blue-primary">
              SOPORTE
            </span>
            <h1 className="text-center text-3xl font-bold tracking-[-1px] text-brand-blue-deep md:text-[48px]">
              Preguntas frecuentes
            </h1>
            <p className="max-w-[720px] text-center text-[15px] font-medium leading-[1.45] text-brand-ink md:text-[17px]">
              Todo lo que un dueño de negocio ocupado necesita saber antes de solicitar. Si te queda
              una duda, escríbenos por WhatsApp — respondemos en minutos.
            </p>
          </div>

          {/* FAQ Items */}
          <div className="flex w-full max-w-[880px] flex-col gap-3.5 md:gap-3.5">
            {FAQ_ITEMS.map((item, idx) => {
              const isOpen = openIndex === idx;
              return (
                <div
                  key={idx}
                  className="rounded-2xl border border-[#E6EEFB] bg-white px-5 py-5 md:px-7 md:py-6"
                >
                  <button
                    type="button"
                    onClick={() => setOpenIndex(isOpen ? -1 : idx)}
                    className="flex w-full items-center justify-between gap-6"
                  >
                    <h2 className="text-left text-base font-semibold tracking-[-0.3px] text-brand-blue-deep md:text-lg">
                      {item.question}
                    </h2>
                    {isOpen ? (
                      <Minus
                        className="h-[22px] w-[22px] shrink-0 text-brand-blue-deep"
                        strokeWidth={2}
                      />
                    ) : (
                      <Plus
                        className="h-[22px] w-[22px] shrink-0 text-brand-blue-deep"
                        strokeWidth={2}
                      />
                    )}
                  </button>
                  {isOpen && (
                    <p className="mt-3.5 text-[14px] font-medium leading-[1.55] text-brand-ink md:text-[15px]">
                      {item.answer}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
