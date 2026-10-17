/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Bundled default policy (mikro-credit v1). The apiserver uses it unless a
 * `credit-policy.json` sits next to mikro.json. Weights and bands are expert
 * guesses to recalibrate once outcomes accumulate (tasks 7.3).
 *
 * Fact layout (built by the apiserver):
 *   app.*      application fields + ageYears
 *   isc.*      form-only Mikro Score (ISC) { score, flags }
 *   equifax.*  latest Equifax facts + ageDays, mikroScore (150–950), features
 *   pcloud.*   latest PrestamosCloud facts + ageDays, loans (all lenders, flat)
 *   mikro.*    Mikro history by cédula { customerExists, tags, loans, paymentRating }
 *   checks.*   identity checks per source { nameMatches, birthDateMatches }
 *   config.*   { coveredProvinces } (normalized)
 */
import type { CreditPolicy } from "./schema.js";

export const POLICY_V1 = {
  id: "mikro_credit",
  version: "1.0.0",
  facts: {
    equifax: { maxAgeDays: 30 },
    pcloud: { maxAgeDays: 30 }
  },
  derive: {
    pcloudUncollectible: {
      agg: "count",
      of: "pcloud.loans",
      where: { left: { fact: "$.uncollectible" }, op: "eq", right: true }
    },
    equifaxWriteOffs: {
      op: "add",
      args: [
        { fact: "equifax.features.countByStatus.CASTIGADO" },
        { fact: "equifax.features.countByStatus.LEGAL" }
      ]
    }
  },
  rules: [
    {
      id: "KO_PCLOUD_DELINQUENT",
      when: { left: { fact: "pcloud.kpis.isDelinquent" }, op: "eq", right: true },
      outcome: "REJECT",
      reason: "PCLOUD_DELINQUENT",
      message: "Cliente moroso en PrestamosCloud"
    },
    {
      id: "KO_PCLOUD_UNCOLLECTIBLE",
      when: { left: { fact: "derived.pcloudUncollectible" }, op: "gt", right: 0 },
      outcome: "REJECT",
      reason: "PCLOUD_UNCOLLECTIBLE",
      message: "Préstamos incobrables en PrestamosCloud"
    },
    {
      id: "KO_EQUIFAX_WRITE_OFF",
      when: { left: { fact: "derived.equifaxWriteOffs" }, op: "gt", right: 0 },
      outcome: "REJECT",
      reason: "EQUIFAX_WRITE_OFF",
      message: "Cuenta castigada o en legal en Equifax"
    },
    {
      id: "KO_EQUIFAX_DPD_90",
      when: { left: { fact: "equifax.features.worstRiskDpd" }, op: "gte", right: 90 },
      outcome: "REJECT",
      reason: "EQUIFAX_DPD_90",
      message: "Atraso de 90 días o más en Equifax (últimos 24 meses)"
    },
    {
      id: "KO_OUT_OF_COVERAGE",
      when: {
        left: { normalize: { fact: "app.province" } },
        op: "notIn",
        right: { fact: "config.coveredProvinces" }
      },
      outcome: "REJECT",
      reason: "OUT_OF_COVERAGE_AREA",
      message: "Fuera de la zona de cobertura"
    },
    {
      id: "KO_MIKRO_FRAUD_WATCH",
      when: { left: { fact: "mikro.tags" }, op: "contains", right: "risk:fraud_watch" },
      outcome: "REJECT",
      reason: "MIKRO_FRAUD_WATCH",
      message: "Marcado en Mikro como riesgo de fraude"
    },
    {
      id: "KO_MIKRO_WRITTEN_OFF",
      when: {
        any_item: "mikro.loans",
        where: { left: { fact: "$.writtenOff" }, op: "eq", right: true }
      },
      outcome: "REJECT",
      reason: "MIKRO_WRITTEN_OFF",
      message: "Tuvo un préstamo con Mikro que se dio por perdido"
    },
    {
      id: "KO_IDENTITY_MISMATCH",
      when: {
        any: [
          { left: { fact: "checks.identity.equifax.nameMatches" }, op: "eq", right: false },
          { left: { fact: "checks.identity.equifax.birthDateMatches" }, op: "eq", right: false },
          { left: { fact: "checks.identity.pcloud.nameMatches" }, op: "eq", right: false },
          { left: { fact: "checks.identity.pcloud.birthDateMatches" }, op: "eq", right: false }
        ]
      },
      outcome: "REJECT",
      reason: "IDENTITY_MISMATCH",
      message: "El nombre o la fecha de nacimiento del buró no coincide con la solicitud"
    },
    {
      id: "KO_AGE",
      when: {
        not: { left: { fact: "app.ageYears" }, op: "between", right: [18, 70] }
      },
      outcome: "REJECT",
      reason: "AGE_OUT_OF_RANGE",
      message: "Edad fuera de 18–70 años"
    }
  ],
  score: {
    components: [
      {
        id: "equifax",
        label: "Equifax",
        weight: 30,
        value: { fact: "equifax.mikroScore" },
        map: { from: [150, 950] }
      },
      {
        id: "pcloud",
        label: "PrestamosCloud",
        weight: 30,
        value: { fact: "pcloud.kpis.score.value" },
        map: { from: [300, 850] }
      },
      {
        id: "isc",
        label: "Solicitud (ISC)",
        weight: 30,
        value: { fact: "isc.score" },
        map: { from: [0, 100] }
      },
      {
        id: "history",
        label: "Historial Mikro",
        weight: 10,
        value: { fact: "mikro.paymentRating" },
        map: { from: [1, 5] }
      }
    ]
  },
  bands: [
    { min: 70, outcome: "APPROVE" },
    { min: 50, outcome: "REVIEW" },
    { min: 0, outcome: "REVIEW", reason: "LOW_MIKRO_SCORE", message: "Mikro Score bajo" }
  ],
  evidence: [
    {
      id: "equifax_lookup",
      label: "Consultar Equifax",
      provides: ["equifax.*", "checks.identity.equifax.*"],
      cost: 1
    },
    {
      id: "pcloud_lookup",
      label: "Consultar PrestamosCloud",
      provides: ["pcloud.*", "checks.identity.pcloud.*"],
      cost: 1
    },
    {
      id: "complete_application",
      label: "Completar la solicitud",
      provides: ["app.*", "isc.*"],
      cost: 0
    }
  ]
} satisfies CreditPolicy;
