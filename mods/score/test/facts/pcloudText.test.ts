/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Lines in the order the Datapréstamos page rendered them on 2026-10-17
 * (people and amounts are fake).
 */
import { expect } from "chai";
import {
  cedulaFromLookupUrl,
  identityFromLines,
  inquiriesFromLines,
  kpisFromLines,
  summaryFromLines
} from "../../src/facts/pcloudText.js";

const page = [
  "DATAPRÉSTAMOS",
  "Score crediticio",
  "Puntuación de 300 a 850 basada en historial de pagos y mora.",
  "399",
  "SCORE CREDITICIO",
  "Muy bajo (300-850)",
  "23%",
  "PAGOS A TIEMPO",
  "7 de 30 prestamos",
  "60%",
  "COMPLETACION",
  "4/4",
  "FACTORES DE RIESGO",
  "Riesgo alto",
  "Ramón Ortiz",
  "Masculino",
  "1972-04-20",
  "Cliente moroso",
  "SI",
  "Préstamos activos",
  "12",
  "Préstamos terminados",
  "18",
  "Empresas con este cliente",
  "14",
  "Capital prestado",
  "RD$254,900.00",
  "Total codeudores",
  "0.00",
  "Moneda",
  "RD",
  "Capital adeudado",
  "RD$86,673.12",
  "Empresas con este cliente",
  "NOMBRE",
  "Historial de consultas de este cliente",
  "Consulta",
  "2026-10-17 09:42:47",
  "Mikro",
  "Análisis IA",
  "2026-07-03 01:38:08",
  "Soluciones Tres",
  "Comentarios de empresas sobre este cliente",
  "Aún no hay comentarios sobre este cliente."
];

describe("Datapréstamos page text", () => {
  it("reads the KPI cards", () => {
    expect(kpisFromLines(page)).to.deep.equal({
      score: "399",
      scoreLabel: "Muy bajo (300-850)",
      onTime: "23%",
      completion: "60%",
      riskFactors: "4/4",
      riskLabel: "Riesgo alto"
    });
  });

  it("reads the summary (first occurrence of a repeated label)", () => {
    const s = summaryFromLines(page);
    expect(s["Cliente moroso"]).to.equal("SI");
    expect(s["Empresas con este cliente"]).to.equal("14");
    expect(s["Capital adeudado"]).to.equal("RD$86,673.12");
  });

  it("reads the identity above the summary", () => {
    expect(identityFromLines(page)).to.deep.equal({
      fullName: "Ramón Ortiz",
      gender: "Masculino",
      birthDate: "1972-04-20"
    });
  });

  it("has no identity for an unknown person", () => {
    expect(identityFromLines(["NO DATOS", "NO DATOS", "Cliente moroso", "NO"])).to.equal(null);
  });

  it("reads the inquiry history", () => {
    expect(inquiriesFromLines(page)).to.deep.equal([
      { type: "Consulta", date: "2026-10-17 09:42:47", lender: "Mikro" },
      { type: "Análisis IA", date: "2026-07-03 01:38:08", lender: "Soluciones Tres" }
    ]);
  });

  it("reads the searched cédula from the lookup URL", () => {
    expect(cedulaFromLookupUrl("/clientes/get_client_data?document_id=037-0022078-7&x=1")).to.equal(
      "037-0022078-7"
    );
  });
});
