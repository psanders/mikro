/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */

export type ContractFrequency = "DAILY" | "WEEKLY" | "BIWEEKLY" | "MONTHLY";

/** Per-contract variable data (the creditor/bank/notary are fixed constants). */
export interface ContractData {
  debtor: {
    name: string;
    cedula: string;
    /** e.g. "casada", "soltero" — lowercased. */
    maritalStatus?: string;
    /** e.g. "empleada privada", "comerciante". */
    occupation?: string;
    city: string;
  };
  /** Loan principal in DOP. */
  principal: number;
  /** Number of installments (cuotas). */
  installments: number;
  frequency: ContractFrequency;
  /** Value of each installment in DOP. */
  installmentAmount: number;
  /** First-payment / start date. */
  startDate: Date;
  /** Date the contract is drafted and signed. */
  contractDate: Date;
}
