/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Maps an existing customer plus founder-supplied terms into ContractData for
 * the shared contract renderer. Kept decoupled from schemas so the contracts
 * module has no dependency on the schema layer; the apiserver validates the
 * input with `generateCustomerContractSchema` before calling this.
 */
import type { Customer } from "../types/customer.js";
import type { ContractData, ContractFrequency } from "./types.js";

/** The debtor identity fields this mapper reads off a customer row. */
export type CustomerContractIdentity = Pick<
  Customer,
  "name" | "idNumber" | "homeAddress" | "jobPosition"
>;

/**
 * Parse a start date into a Date anchored at local noon. A bare `yyyy-mm-dd`
 * (what the dashboard's date input emits) would otherwise parse as UTC midnight,
 * which the renderer's local `getDate()`/`getMonth()` read as the previous day in
 * a negative-offset timezone (America/Santo_Domingo is UTC-4). Anchoring at noon
 * keeps the calendar day stable across timezones.
 */
function toStartDate(value: string | Date): Date {
  if (value instanceof Date) return value;
  const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (ymd) return new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]), 12, 0, 0);
  return new Date(value);
}

/** Founder-supplied negotiated loan terms. */
export interface CustomerContractTerms {
  principal: number;
  installments: number;
  installmentAmount: number;
  frequency: ContractFrequency;
  startDate: string | Date;
  maritalStatus?: string;
  occupation?: string;
}

/**
 * Build ContractData from a customer and the supplied terms. Identity comes from
 * the customer (name, cédula ← idNumber, city ← homeAddress, occupation ←
 * override ?? jobPosition); terms come from the founder. The contract date
 * defaults to now.
 */
export function buildContractDataFromCustomer(
  customer: CustomerContractIdentity,
  terms: CustomerContractTerms,
  contractDate: Date = new Date()
): ContractData {
  return {
    debtor: {
      name: customer.name,
      cedula: customer.idNumber,
      maritalStatus: terms.maritalStatus ?? undefined,
      occupation: terms.occupation ?? customer.jobPosition ?? undefined,
      city: customer.homeAddress
    },
    principal: terms.principal,
    installments: terms.installments,
    installmentAmount: terms.installmentAmount,
    frequency: terms.frequency,
    startDate: toStartDate(terms.startDate),
    contractDate
  };
}
