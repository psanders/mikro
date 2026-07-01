/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */

/**
 * Customer entity type.
 */
export interface Customer {
  id: string;
  name: string;
  nickname?: string | null;
  phone: string;
  idNumber: string;
  collectionPoint?: string;
  homeAddress: string;
  jobPosition?: string | null;
  income?: number | null;
  isBusinessOwner: boolean;
  isActive: boolean;
  idCardOnRecord: boolean;
  notes?: string | null;
  preferredPaymentDay?: string | null;
  /** QCobro portfolio ids this customer was assigned to as of the last successful sync (JSON array string). */
  lastSyncedPortfolios?: string | null;
  createdById?: string | null;
  assignedCollectorId: string;
  createdAt: Date;
  updatedAt: Date;
}
