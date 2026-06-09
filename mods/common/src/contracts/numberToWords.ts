/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Spanish (Dominican) integer-to-words for contract amounts, e.g.
 * 10000 -> "diez mil", 1300 -> "mil trescientos", 21000 -> "veintiún mil".
 * Applies the masculine apocope ("uno" -> "un") since amounts qualify "pesos".
 */

const UNITS = [
  "cero",
  "uno",
  "dos",
  "tres",
  "cuatro",
  "cinco",
  "seis",
  "siete",
  "ocho",
  "nueve",
  "diez",
  "once",
  "doce",
  "trece",
  "catorce",
  "quince",
  "dieciséis",
  "diecisiete",
  "dieciocho",
  "diecinueve",
  "veinte",
  "veintiuno",
  "veintidós",
  "veintitrés",
  "veinticuatro",
  "veinticinco",
  "veintiséis",
  "veintisiete",
  "veintiocho",
  "veintinueve"
];
const TENS = [
  "",
  "",
  "",
  "treinta",
  "cuarenta",
  "cincuenta",
  "sesenta",
  "setenta",
  "ochenta",
  "noventa"
];
const HUNDREDS = [
  "",
  "ciento",
  "doscientos",
  "trescientos",
  "cuatrocientos",
  "quinientos",
  "seiscientos",
  "setecientos",
  "ochocientos",
  "novecientos"
];

function below100(n: number): string {
  if (n < 30) return UNITS[n];
  const t = Math.floor(n / 10);
  const u = n % 10;
  return u ? `${TENS[t]} y ${UNITS[u]}` : TENS[t];
}

function below1000(n: number): string {
  if (n === 100) return "cien";
  const h = Math.floor(n / 100);
  const r = n % 100;
  const head = h ? HUNDREDS[h] : "";
  if (!r) return head;
  return head ? `${head} ${below100(r)}` : below100(r);
}

/** Spell a non-negative integer (0..999,999,999) in Spanish, masculine. */
export function numberToWords(value: number): string {
  const n = Math.floor(Math.abs(value));
  if (n === 0) return "cero";

  const parts: string[] = [];
  const millions = Math.floor(n / 1_000_000);
  const thousands = Math.floor((n % 1_000_000) / 1000);
  const rest = n % 1000;

  if (millions) parts.push(millions === 1 ? "un millón" : `${below1000(millions)} millones`);
  if (thousands) parts.push(thousands === 1 ? "mil" : `${below1000(thousands)} mil`);
  if (rest) parts.push(below1000(rest));

  // Masculine apocope: amounts qualify "pesos" (and precede "mil"/"millones").
  return parts
    .join(" ")
    .replace(/\bveintiuno\b/g, "veintiún")
    .replace(/\buno\b/g, "un");
}

/** "DIEZ MIL PESOS DOMINICANOS (RD$10,000.00)" — words uppercased + the figure. */
export function pesosInWords(value: number): string {
  const whole = Math.floor(Math.abs(value));
  const words = numberToWords(whole).toUpperCase();
  const figure = whole.toLocaleString("es-DO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return `${words} PESOS DOMINICANOS (RD$${figure})`;
}
