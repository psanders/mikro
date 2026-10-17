/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import { fromInteractiveReport } from "../../src/adapter.js";

const grid = (recent: string[]) => [...Array(48 - recent.length).fill("-"), ...recent];

const api = {
  bloque_actividadcred: {
    actividadcred: [
      {
        ventana48Meses: [
          {
            referencia: 7,
            economicAreaDescr: "FIN",
            productTypeCode: "PRE",
            currencyCode: "DO",
            amount: grid(["0", "1", "2", "-"])
          }
        ],
        porcentajeMontosAdeudados: [
          { referencia: 7, amount: grid(["%>0<20", "%>=60<80", "%>100", "-"]) }
        ]
      }
    ]
  },
  bloque_balancevenci: {
    balancevenci: [
      {
        creditosPorTipo: {
          prestamos: {
            detallePorCredito: [
              {
                referencia: 7,
                status: "CASTIGADA",
                statusCuentaCerrada: false,
                creditoAprobado: 5000,
                totalAdeudado: 4000,
                totalVencido: 1000,
                cuota: 500,
                fechaApertura: "03/02/2025"
              }
            ]
          }
        }
      }
    ]
  },
  bloque_analisiscred: {
    analisiscred: [
      {
        analisisDeLosCreditos: {
          fechaCreditoMasAntiguo: "04/2017",
          fechaCreditoMasReciente: "02/2025"
        }
      }
    ]
  },
  bloque_consul: {
    consul: [{ historial: [{ historyDateHour: "20260911", historyEconomicSector: "FINANCIERO" }] }]
  },
  bloque_identi: { identi: [{ padron: { nombre: "should never be read" } }] }
};

describe("fromInteractiveReport", () => {
  it("reverses API grids to most-recent-first and buckets utilization", () => {
    const a = fromInteractiveReport(api, "2026-10-13").accounts[0];
    expect(a.pdv.slice(0, 4)).to.equal("-210");
    expect(a.util.slice(0, 4)).to.equal("-641");
    expect(a.pdv).to.have.length(48);
  });

  it("maps status, amounts, dates and inquiries", () => {
    const r = fromInteractiveReport(api, "2026-10-13");
    expect(r.accounts[0].status).to.equal("CASTIGADO");
    expect(r.accounts[0].owed).to.equal(4000);
    expect(r.accounts[0].opened).to.equal("2025-02");
    expect(r.summary).to.deep.equal({ oldestCredit: "2017-04", newestCredit: "2025-02" });
    expect(r.inquiries).to.deep.equal([{ date: "2026-09-11", sector: "FINANCIERO" }]);
  });

  it("treats closed accounts as CANCELADA", () => {
    const closed = structuredClone(api);
    const d =
      closed.bloque_balancevenci.balancevenci[0].creditosPorTipo.prestamos.detallePorCredito[0];
    d.status = "ART.68, P.3 LEY 172-13";
    d.statusCuentaCerrada = true;
    expect(fromInteractiveReport(closed, "2026-10-13").accounts[0].status).to.equal("CANCELADA");
  });

  it("carries no identification data", () => {
    expect(JSON.stringify(fromInteractiveReport(api, "2026-10-13"))).not.to.include(
      "should never be read"
    );
  });
});
