/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, UserCheck, ArrowRight } from "lucide-react";
import { clsx } from "clsx";
import { calculateLoanOptions, type LoanOption } from "@mikro/calculate-loan";
import {
  SIMULATOR_MIN_AMOUNT,
  SIMULATOR_MAX_AMOUNT,
  SIMULATOR_STEP_AMOUNT,
  SIMULATOR_INITIAL_AMOUNT,
  SIMULATOR_INTEREST_RATE,
  SIMULATOR_PAYMENT_FREQUENCY,
  SIMULATOR_BASE_DURATION,
  SIMULATOR_OPTIONS_RANGE,
  SIMULATOR_INITIAL_DURATION,
  SIMULATOR_DISPLAY_DURATIONS
} from "../lib/simulatorConfig";

/** Design canvas: card at (80, 30) 440×560; badges at (-10, 430) and (380, 120) in 620px-tall area */
const CANVAS_HEIGHT = 620;
const CARD_OFFSET_LEFT = 80;
const CARD_OFFSET_TOP = 30;
const BADGE_BUREAU = { left: -10, top: 430 };
const BADGE_APPROVAL = { left: 380, top: 120 };

const DISPLAY_DURATION_SET = new Set<number>(SIMULATOR_DISPLAY_DURATIONS);

function pickDurationOptions(options: LoanOption[]): LoanOption[] {
  const filtered = options.filter((o) => DISPLAY_DURATION_SET.has(o.duration));
  return (filtered.length > 0 ? filtered : options).sort((a, b) => a.duration - b.duration);
}

interface SimulatorProps {
  replayKey?: number;
}

export const Simulator: React.FC<SimulatorProps> = ({ replayKey = 0 }) => {
  const [amount, setAmount] = useState(SIMULATOR_INITIAL_AMOUNT);
  const [duration, setDuration] = useState(SIMULATOR_INITIAL_DURATION);
  const [showBadges, setShowBadges] = useState(false);
  const [badgesStage, setBadgesStage] = useState<0 | 1 | 2>(0);
  const [sliderHighlight, setSliderHighlight] = useState(false);

  const loanResult = useMemo(
    () =>
      calculateLoanOptions({
        principal: amount,
        interestRate: SIMULATOR_INTEREST_RATE,
        paymentFrequency: SIMULATOR_PAYMENT_FREQUENCY,
        baseDuration: SIMULATOR_BASE_DURATION,
        optionsRange: SIMULATOR_OPTIONS_RANGE
      }),
    [amount]
  );

  const durationOptions = useMemo(
    () => pickDurationOptions(loanResult.options),
    [loanResult.options]
  );

  const selectedOption = durationOptions.find((o) => o.duration === duration) ?? durationOptions[0];

  useEffect(() => {
    if (durationOptions.length === 0) return;
    if (!durationOptions.some((o) => o.duration === duration)) {
      const fallback =
        durationOptions.find((o) => o.duration === SIMULATOR_INITIAL_DURATION) ??
        durationOptions.find((o) => o.isBase) ??
        durationOptions[0];
      setDuration(fallback.duration);
    }
  }, [durationOptions, duration]);

  useEffect(() => {
    setShowBadges(false);
    setBadgesStage(0);
    setSliderHighlight(false);

    const t1 = setTimeout(() => {
      setShowBadges(true);
      setBadgesStage(2);
    }, 1000);
    const t2 = setTimeout(() => setBadgesStage(1), 4000);
    const t3 = setTimeout(() => {
      setBadgesStage(0);
      setShowBadges(false);
    }, 5500);
    const t4 = setTimeout(() => {
      setSliderHighlight(true);
      setTimeout(() => setSliderHighlight(false), 2200);
    }, 6200);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [replayKey]);

  const fillPercent =
    ((amount - SIMULATOR_MIN_AMOUNT) / (SIMULATOR_MAX_AMOUNT - SIMULATOR_MIN_AMOUNT)) * 100;

  const badgeClass =
    "absolute z-10 hidden items-center gap-2.5 rounded-full bg-white px-4 py-3 shadow-[0_12px_32px_rgba(0,22,74,0.2)] md:flex";

  const cardProps = {
    amount,
    setAmount,
    duration,
    setDuration,
    durationOptions,
    selectedOption,
    fillPercent,
    sliderHighlight
  };

  return (
    <div className="relative mx-auto w-full max-w-[440px] md:mx-0 md:max-w-[520px]">
      <div className="relative hidden md:block md:w-full" style={{ height: CANVAS_HEIGHT }}>
        <AnimatePresence>
          {showBadges && badgesStage >= 2 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className={badgeClass}
              style={{ left: BADGE_BUREAU.left, top: BADGE_BUREAU.top }}
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#E7F0FF]">
                <Sparkles className="h-4 w-4 text-brand-blue-deep" strokeWidth={2} />
              </div>
              <div className="flex flex-col whitespace-nowrap">
                <span className="text-[13px] font-semibold text-brand-ink">
                  Bureau + IA cruzados
                </span>
                <span className="text-[11px] font-medium text-[#5B6B8C]">Listo en 12 segundos</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showBadges && badgesStage >= 1 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className={badgeClass}
              style={{ left: BADGE_APPROVAL.left, top: BADGE_APPROVAL.top }}
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#FFE7D6]">
                <UserCheck className="h-4 w-4 text-brand-orange-deep" strokeWidth={2} />
              </div>
              <div className="flex flex-col whitespace-nowrap">
                <span className="text-[13px] font-semibold text-brand-ink">
                  Aprobado por Mariela R.
                </span>
                <span className="text-[11px] font-medium text-[#5B6B8C]">
                  Oficial de crédito · Puerto Plata
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div
          className="absolute z-0 flex w-full max-w-[440px] flex-col gap-[22px] rounded-3xl bg-white p-8 shadow-[0_24px_60px_rgba(0,22,74,0.4)]"
          style={{ left: CARD_OFFSET_LEFT, top: CARD_OFFSET_TOP }}
        >
          <SimulatorCardBody {...cardProps} desktop />
        </div>
      </div>

      <div className="relative z-0 flex flex-col gap-[18px] rounded-3xl bg-white p-6 shadow-[0_24px_60px_rgba(0,22,74,0.4)] md:hidden">
        <SimulatorCardBody {...cardProps} desktop={false} />
      </div>
    </div>
  );
};

interface SimulatorCardBodyProps {
  amount: number;
  setAmount: (n: number) => void;
  duration: number;
  setDuration: (n: number) => void;
  durationOptions: LoanOption[];
  selectedOption: LoanOption | undefined;
  fillPercent: number;
  sliderHighlight: boolean;
  desktop: boolean;
}

function SimulatorCardBody({
  amount,
  setAmount,
  duration,
  setDuration,
  durationOptions,
  selectedOption,
  fillPercent,
  sliderHighlight,
  desktop
}: SimulatorCardBodyProps) {
  const paymentPerPeriod = selectedOption?.paymentPerPeriod ?? 0;
  const interestPercent = selectedOption
    ? (selectedOption.interestRate * 100).toFixed(1)
    : (SIMULATOR_INTEREST_RATE * 100).toFixed(1);

  return (
    <>
      <div className="flex items-center justify-between">
        <span
          className={`font-semibold uppercase tracking-[1.5px] text-[#5B6B8C] ${
            desktop ? "text-sm" : "text-[13px]"
          }`}
        >
          Simulador
        </span>
        <div className="flex items-center gap-1.5 rounded-full bg-[#D6F3E5] px-2.5 py-1.5">
          <div className="h-1.5 w-1.5 rounded-full bg-[#0E7C5F]" />
          <span className="text-[11px] font-semibold text-[#0E7C5F] max-md:max-w-[120px] max-md:leading-tight">
            {desktop ? "Aprobación en menos de 24h" : "Pre-aprobación"}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-[13px] font-medium text-[#5B6B8C]">Monto solicitado</span>
        <span
          className={`font-bold tracking-tight text-brand-blue-deep ${
            desktop ? "text-[42px]" : "text-[38px]"
          }`}
        >
          RD$ {amount.toLocaleString("es-DO")}
        </span>

        <div className="relative flex h-6 items-center">
          <div
            aria-hidden
            className={clsx(
              "pointer-events-none absolute inset-x-0 h-1.5 rounded-full transition-shadow duration-500",
              sliderHighlight && "shadow-[0_0_10px_2px_rgba(246,138,31,0.55)]"
            )}
            style={{
              background: `linear-gradient(to right, #F68A1F ${fillPercent}%, #E9F2FF ${fillPercent}%)`
            }}
          />
          <input
            type="range"
            min={SIMULATOR_MIN_AMOUNT}
            max={SIMULATOR_MAX_AMOUNT}
            step={SIMULATOR_STEP_AMOUNT}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="simulator-range relative z-10 h-1.5 w-full appearance-none bg-transparent outline-none"
          />
        </div>

        <div className="flex justify-between">
          <span className="text-[11px] font-medium text-[#5B6B8C]">
            RD${SIMULATOR_MIN_AMOUNT.toLocaleString("es-DO")}
          </span>
          <span className="text-[11px] font-medium text-[#5B6B8C]">
            RD${SIMULATOR_MAX_AMOUNT.toLocaleString("es-DO")}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        <span className="text-[13px] font-medium text-[#5B6B8C]">Plazo</span>
        <div className={`grid grid-cols-4 ${desktop ? "gap-2" : "gap-1.5"}`}>
          {durationOptions.map((option) => (
            <button
              key={option.duration}
              type="button"
              onClick={() => setDuration(option.duration)}
              className={`flex items-center justify-center rounded-[10px] border font-semibold transition-colors ${
                desktop ? "py-2.5 text-[13px]" : "py-2 text-xs"
              } ${
                duration === option.duration
                  ? "border-transparent bg-brand-blue-deep text-white"
                  : "border-[#E6EEFB] bg-white text-brand-ink hover:border-brand-blue-deep/30"
              }`}
            >
              {desktop ? `${option.duration} semanas` : `${option.duration} sem`}
            </button>
          ))}
        </div>
      </div>

      <div className="h-px w-full bg-[#E6EEFB]" />

      <div className="flex items-end justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-[#5B6B8C]">Cuota semanal estimada</span>
          <span className="text-2xl font-bold tracking-[-0.5px] text-brand-blue-deep">
            RD$ {paymentPerPeriod.toLocaleString("es-DO")}
          </span>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-xs font-medium text-[#5B6B8C]">Tasa base</span>
          <span className="text-2xl font-bold tracking-[-0.5px] text-brand-orange-deep">
            {interestPercent}%
          </span>
        </div>
      </div>

      <button
        type="button"
        className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-brand-blue-deep py-4 text-[15px] font-semibold text-white transition-colors duration-200 hover:bg-brand-blue-primary active:bg-[#0d3278]"
      >
        Continuar solicitud
        <ArrowRight className="h-4 w-4" strokeWidth={2} />
      </button>
    </>
  );
}
