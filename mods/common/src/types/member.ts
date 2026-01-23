/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */

/**
 * Member entity type.
 */
export interface Member {
  id: string;
  name: string;
  phone: string;
  idNumber: string;
  collectionPoint: string;
  homeAddress: string;
  jobPosition?: string | null;
  income?: number | null;
  isBusinessOwner: boolean;
  isActive: boolean;
  idCardOnRecord: boolean;
  createdById?: string | null;
  referredById?: string | null;
  assignedCollectorId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}
