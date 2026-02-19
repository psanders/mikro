/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */

/**
 * Customer entity type.
 */
export interface Customer {
  id: string;
  name: string;
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
  createdById?: string | null;
  referredById: string;
  assignedCollectorId: string;
  createdAt: Date;
  updatedAt: Date;
}
