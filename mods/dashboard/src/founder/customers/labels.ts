/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { CustomerDocumentType } from "@mikro/common/schemas";

export const DOCUMENT_TYPE_LABELS: Record<CustomerDocumentType, string> = {
  ID_FRONT: "Cédula (frente)",
  ID_BACK: "Cédula (atrás)",
  CONTRACT: "Contrato",
  BUSINESS_PHOTO: "Foto del negocio",
  OTHER: "Otro"
};

/** What an upload from the profile may be (a contract comes from a renewal or a loan). */
export const UPLOAD_TYPES: CustomerDocumentType[] = [
  "ID_FRONT",
  "ID_BACK",
  "BUSINESS_PHOTO",
  "CONTRACT",
  "OTHER"
];

export const documentTypeLabel = (t: string): string =>
  DOCUMENT_TYPE_LABELS[t as CustomerDocumentType] ?? t;

/** Files the profile and renewal panel accept (matches the server's mime list). */
export const ACCEPT_FILES = "image/jpeg,image/png,image/webp,application/pdf";
