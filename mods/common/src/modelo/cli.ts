/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * `model-simulation` — interactive break-even simulator over a mikro.db copy.
 *
 * Calibrates the Modelo projection engine (the same one behind the dashboard
 * "Modelo" screen and PDF) from real cohort data, lets the user tweak each
 * lever with the calibrated value prefilled, runs the projection, and loops.
 *
 *   npm run model-simulation -- ./mikro.db
 *   npm run model-simulation -- ./mikro.db --cohort-months 2 --recent-cohorts 2 --yes
 */
import {
  runProjection,
  type FrecuenciaPago,
  type ProjectionConfig,
  type ProjectionResult
} from "../projection/engine.js";
import { createAsker } from "./asker.js";
import { calibrateFromDb, type ModeloCalibration } from "./calibrate.js";
import { effectiveDefaultRate } from "./collectionRate.js";
import { computePnl } from "./profitAndLoss.js";

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

function parseArgs(argv: string[]): {
  dbPath: string;
  cohortMonths: number;
  recentCohorts: number;
  yes: boolean;
} {
  const args = argv.slice(2);
  let dbPath = "";
  let cohortMonths = 2;
  let recentCohorts = 2;
  let yes = false;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--cohort-months") cohortMonths = Number(args[++i]);
    else if (a === "--recent-cohorts") recentCohorts = Number(args[++i]);
    else if (a === "--yes" || a === "-y") yes = true;
    else if (a === "--help" || a === "-h") {
      console.log(
        "Uso: model-simulation <ruta a mikro.db> [--cohort-months N] [--recent-cohorts N] [--yes]\n\n" +
          "Calibra el modelo de negocio desde una copia de mikro.db y simula\n" +
          "escenarios de forma interactiva. --yes corre directo con los valores\n" +
          "calibrados, sin preguntas."
      );
      process.exit(0);
    } else if (!a.startsWith("-")) dbPath = a;
  }
  if (!dbPath) {
    console.error("Falta la ruta a mikro.db. Uso: model-simulation <ruta a mikro.db>");
    process.exit(1);
  }
  if (!(cohortMonths >= 1) || !(recentCohorts >= 1)) {
    console.error("--cohort-months y --recent-cohorts deben ser >= 1");
    process.exit(1);
  }
  return { dbPath, cohortMonths, recentCohorts, yes };
}

function printCalibration(cal: ModeloCalibration): void {
  console.log(`\nCohortes (ventanas de ${cal.cohortMonths} meses, al ${cal.asOf}):`);
  for (const c of cal.cohorts) {
    const def = c.defaultedLoans > 0 ? `  defaults ${c.defaultedLoans}` : "";
    console.log(
      `  ${c.label}  ${String(c.loans).padStart(2)} préstamos  ` +
        `principal ${fmt(c.principal).padStart(8)}  ` +
        `cobrado ${pct(c.collectionRate).padStart(6)} de lo vencido${def}`
    );
  }
  const f = cal.facts;
  console.log(
    `\nCalibrado con las últimas ${cal.recentCohorts} cohortes (lo viejo se muestra pero no pesa):`
  );
  console.log(`  Tasa de cobro reciente:  ${pct(f.collectionRate)}`);
  console.log(`  Pérdida por default:     ${pct(f.lossRate)} del principal (todo el libro)`);
  console.log(`  Pagos con mora:          ${pct(f.lateShare)}`);
  console.log(`  Gastos fijos:            ${fmt(f.opexMonthlyAvg)} DOP/mes`);
  console.log(`  Cartera viva:            ${fmt(f.outstandingPrincipal)} DOP en la calle`);
  console.log(`  Atrasos en cartera:      ${fmt(f.activePastDue)} DOP vencidos sin cobrar`);
  console.log(
    `  Ritmo:                   ${f.paceLoansPerMonth.toFixed(1)} préstamos/mes (últimos 3 meses)`
  );
  const d = cal.defaultRate;
  console.log(
    `\nDe tasa de cobro a "default" del modelo (el motor no tiene pagos a medias:` +
      `\ncada préstamo paga completo o se pierde, así que el faltante se traduce a default):`
  );
  console.log(`  Si NADA de los atrasos se cobra:      default ${pct(d.ifNoPastDueIsCollected)}`);
  console.log(
    `  Si TODO lo atrasado termina pagando:  default ${pct(d.ifAllPastDueIsCollected)} (solo lo ya perdido)`
  );
  console.log(
    `  Supuesto precargado (recuperas ${pct(d.recoveryAssumption)} de los atrasos): default ${pct(d.atAssumedRecovery)}`
  );
}

type Lever = {
  key: keyof ProjectionConfig;
  label: string;
  kind: "money" | "percent" | "int" | "frequency";
};

const LEVERS: Lever[] = [
  { key: "inversionInicial", label: "Capital inicial (caja + cartera viva), DOP", kind: "money" },
  { key: "inversionMensual", label: "Inyección mensual de capital fresco, DOP", kind: "money" },
  { key: "gastosFijosMensuales", label: "Gastos fijos mensuales, DOP", kind: "money" },
  { key: "prestamoPromedio", label: "Préstamo promedio, DOP", kind: "money" },
  { key: "tasaInteres", label: "Interés total por préstamo, %", kind: "percent" },
  { key: "plazoBase", label: "Plazo (número de cuotas)", kind: "int" },
  {
    key: "frecuenciaPago",
    label: "Frecuencia (SEMANAL/QUINCENAL/DIARIO/MENSUAL)",
    kind: "frequency"
  },
  { key: "prestamosPorSemana", label: "Préstamos nuevos por semana", kind: "int" },
  { key: "tasaMorosidad", label: "Morosidad (pagos que llegan tarde), %", kind: "percent" },
  { key: "tasaDefault", label: "Default (préstamos que nunca pagan), %", kind: "percent" },
  { key: "horizonteMeses", label: "Horizonte de simulación, meses", kind: "int" }
];

/**
 * Asked just before `tasaDefault`: the recovery assumption drives it, and the
 * derived value becomes that lever's prefill so it stays overridable.
 */
const RECOVERY_LEVER_KEY: keyof ProjectionConfig = "tasaDefault";

const FREQUENCIES: FrecuenciaPago[] = ["DIARIO", "SEMANAL", "QUINCENAL", "MENSUAL"];

function displayValue(lever: Lever, config: ProjectionConfig): string {
  const v = config[lever.key];
  if (lever.kind === "percent") return (Number(v) * 100).toFixed(0);
  if (lever.kind === "money") return fmt(Number(v));
  return String(v);
}

function parseAnswer(lever: Lever, answer: string): number | FrecuenciaPago | null {
  const raw = answer
    .trim()
    .replace(/[,%\s]/g, "")
    .toUpperCase();
  if (raw === "") return null;
  if (lever.kind === "frequency") {
    const match = FREQUENCIES.find((f) => f.startsWith(raw));
    if (!match) throw new Error(`Frecuencia inválida: ${answer}`);
    return match;
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) throw new Error(`Número inválido: ${answer}`);
  if (lever.kind === "percent") return n / 100;
  if (lever.kind === "int") return Math.max(1, Math.round(n));
  return n;
}

function printResult(result: ProjectionResult): void {
  const s = result.summary;
  const pnl = computePnl(result);
  console.log("\n" + "=".repeat(72));
  console.log("RESULTADO");
  console.log("=".repeat(72));
  console.log(
    `  Cuota: ${fmt(s.loanTerms.paymentPerPeriod)} × ${s.loanTerms.termLength} = ` +
      `${fmt(s.loanTerms.actualTotal)} por préstamo de ${fmt(s.loanTerms.principal)} ` +
      `(ganancia ${fmt(s.loanTerms.profitPerLoan)}, ${pct(pnl.interestShare)} de cada cuota)`
  );
  console.log(
    `  Equilibrio operativo: ${
      pnl.operatingBreakevenMonth === null
        ? "NO se alcanza en el horizonte"
        : `mes ${pnl.operatingBreakevenMonth} (el mes se paga solo)`
    }`
  );
  console.log(
    `  Recupera lo perdido:  ${
      pnl.paybackMonth === null ? "NO en el horizonte" : `mes ${pnl.paybackMonth}`
    }`
  );
  console.log(`  Ganancia mensual madura:   ${fmt(pnl.matureMonthlyNet)} DOP/mes`);
  console.log(`  Ganancia acumulada:        ${fmt(pnl.cumulativeNet)} DOP`);
  console.log(`  Capital total invertido:   ${fmt(s.totalInvested)} DOP`);
  console.log(`  Préstamos colocados:       ${s.totalLoansPlaced}`);
  // The engine returns 999 as its "not viable at any volume" sentinel.
  console.log(
    s.minLoansPerWeekForBreakeven >= 999
      ? `  Mínimo para cubrir gastos: imposible — a este default cada préstamo pierde dinero`
      : `  Mínimo para cubrir gastos: ${s.minLoansPerWeekForBreakeven} préstamos nuevos/semana` +
          ` (colocas ${result.config.prestamosPorSemana})`
  );

  console.log(
    `\n  Ganancia = solo el interés de lo cobrado, menos gastos y pérdidas.` +
      `\n  El capital que regresa NO es ganancia.`
  );
  console.log(`\n  mes    cobra  interés    gastos  pérdidas  resultado  acumulado`);
  for (const m of pnl.months) {
    if (m.month <= 6 || m.month % 3 === 0 || m.month === pnl.months.length) {
      console.log(
        `  ${String(m.month).padStart(3)}  ${fmt(m.collections).padStart(7)}` +
          `  ${fmt(m.interestEarned + m.moraIncome).padStart(7)}  ${fmt(m.fixedCosts).padStart(8)}` +
          `  ${fmt(m.defaultLosses).padStart(8)}  ${fmt(m.net).padStart(9)}` +
          `  ${fmt(m.cumulativeNet).padStart(9)}`
      );
    }
  }

  // The engine's own sensitivity rows quote its inflated profit metric, so
  // rebuild the scenarios here and score them with the corrected P&L.
  console.log("\n  Sensibilidad (mismo cálculo corregido):");
  const variants: { label: string; config: ProjectionConfig }[] = [
    {
      label: "Cobras todo lo atrasado",
      config: { ...result.config, tasaDefault: Math.min(result.config.tasaDefault, 0.1) }
    },
    {
      label: "Default duplicado",
      config: { ...result.config, tasaDefault: Math.min(result.config.tasaDefault * 2, 0.9) }
    },
    {
      label: "+1 préstamo/semana",
      config: { ...result.config, prestamosPorSemana: result.config.prestamosPorSemana + 1 }
    },
    {
      label: "Interés +10 puntos",
      config: { ...result.config, tasaInteres: result.config.tasaInteres + 0.1 }
    }
  ];
  for (const v of variants) {
    const p = computePnl(runProjection(v.config));
    console.log(
      `    ${v.label.padEnd(24)} ${fmt(p.matureMonthlyNet).padStart(8)} DOP/mes maduro · ` +
        (p.operatingBreakevenMonth === null
          ? "sin equilibrio"
          : `equilibrio mes ${p.operatingBreakevenMonth}`)
    );
  }
}

export async function main(argv: string[]): Promise<void> {
  const { dbPath, cohortMonths, recentCohorts, yes } = parseArgs(argv);

  console.log(`Leyendo ${dbPath}…`);
  const cal = await calibrateFromDb({ dbPath, cohortMonths, recentCohorts });
  printCalibration(cal);

  const config: ProjectionConfig = { ...cal.prefill };
  let recovery = cal.defaultRate.recoveryAssumption;

  if (yes) {
    printResult(runProjection(config));
    return;
  }

  const rl = await createAsker();
  try {
    let firstPass = true;
    for (;;) {
      console.log(
        firstPass
          ? "\nAjusta cada variable (Enter mantiene el valor calibrado):"
          : "\nAjusta variables (Enter mantiene el valor actual):"
      );
      firstPass = false;
      for (const lever of LEVERS) {
        if (lever.key === RECOVERY_LEVER_KEY) {
          for (;;) {
            const answer = await rl.ask(
              `  De los ${fmt(cal.facts.activePastDue)} DOP atrasados, ¿qué % terminas cobrando? [${(recovery * 100).toFixed(0)}]: `
            );
            const raw = answer.trim().replace(/[,%\s]/g, "");
            if (raw === "") break;
            const n = Number(raw);
            if (!Number.isFinite(n) || n < 0 || n > 100) {
              console.log("    Porcentaje inválido (0-100)");
              continue;
            }
            recovery = n / 100;
            break;
          }
          config.tasaDefault =
            Math.round(
              effectiveDefaultRate({
                collectionRate: cal.facts.collectionRate,
                term: config.plazoBase,
                recovery,
                formalLossRate: cal.facts.lossRate
              }) * 100
            ) / 100;
        }
        for (;;) {
          const answer = await rl.ask(`  ${lever.label} [${displayValue(lever, config)}]: `);
          try {
            const parsed = parseAnswer(lever, answer);
            if (parsed !== null) {
              (config[lever.key] as number | FrecuenciaPago) = parsed;
            }
            break;
          } catch (e) {
            console.log(`    ${(e as Error).message}`);
          }
        }
      }

      printResult(runProjection(config));

      const again = await rl.ask("\n¿Ajustar variables y simular de nuevo? (s/N): ");
      if (!/^s/i.test(again.trim())) break;
    }
  } finally {
    rl.close();
  }
}
