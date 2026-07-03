/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Deterministic in-memory data for Maestro e2e builds, served by `e2eMockLink`
 * in place of a live apiserver. One reviewer-visible application (IN_REVIEW, so
 * it appears in the evaluator queue and is editable + discardable) plus a fake
 * reviewer user. The mutation helpers mutate the store the way the real
 * procedures would (light re-derivation of the columns the UI reads back), so a
 * flow can edit → save → assert the change, or discard → assert it's gone.
 *
 * Values mirror the Pencil sample data (Ramón Objío) so screenshots/assertions
 * line up with the design frames.
 */
import type { LoanApplication } from "@mikro/common";

const REVIEWER_ID = "e2e-reviewer-1";

export const E2E_USERS = [{ id: REVIEWER_ID, name: "Pedro Test" }];

/** The single seeded application, rebuilt fresh whenever the store resets. */
function makeApplication(): LoanApplication {
  const now = new Date();
  const rawData: Record<string, string> = {
    firstName: "Ramón",
    lastName: "Objío",
    phone: "(809) 555-0142",
    idNumber: "001-2345678-9",
    dateOfBirth: "1985-03-14",
    maritalStatus: "Casado(a)",
    businessType: "COLMADO",
    businessName: "Colmado La Esperanza",
    businessAge: "3 a 5 años",
    monthlySales: "RD$50,000 – RD$100,000",
    locationType: "Alquilado",
    formalization: "Informal (sin RNC)",
    employeeCount: "1 a 3",
    businessPhone: "(809) 555-0143",
    requestedAmount: "50,000",
    purpose: "Capital de trabajo",
    requestedTermWeeks: "15 semanas",
    spouseName: "María Objío",
    spousePhone: "(809) 555-0144",
    referenceName: "Juan Pérez",
    referencePhone: "(809) 555-0145",
    housingType: "Alquilada",
    residenceTime: "5 a 10 años",
    homeAddress: "Calle Duarte #45",
    province: "SANTIAGO",
    addressReference: "Cerca del parque central"
  };
  return {
    id: "e2e-app-0001",
    sessionId: "e2e-session-0001",
    status: "IN_REVIEW",
    source: "FORM",
    lastSection: null,
    firstName: "Ramón",
    lastName: "Objío",
    phone: "+18095550142",
    idNumber: "001-2345678-9",
    dateOfBirth: new Date("1985-03-14"),
    maritalStatus: "Casado(a)",
    businessType: "COLMADO",
    businessName: "Colmado La Esperanza",
    requestedAmount: 50000,
    purpose: "Capital de trabajo",
    requestedTermWeeks: 15,
    province: "SANTIAGO",
    homeAddress: "Calle Duarte #45",
    rawData,
    scoreData: null,
    score: 72,
    riskBand: "MODERATE_RISK",
    recommendation: "REVIEW",
    scoredAt: now,
    reviewedById: REVIEWER_ID,
    reviewedAt: null,
    reviewNote: null,
    contractFilename: null,
    contractOriginalName: null,
    contractMimeType: null,
    contractSize: null,
    contractSha256: null,
    signedById: null,
    signedAt: null,
    idFrontFilename: null,
    idFrontOriginalName: null,
    idFrontMimeType: null,
    idFrontSize: null,
    idBackFilename: null,
    idBackOriginalName: null,
    idBackMimeType: null,
    idBackSize: null,
    idUploadedById: null,
    idUploadedAt: null,
    customerId: null,
    loanId: null,
    submittedAt: now,
    createdAt: now,
    updatedAt: now
  };
}

/** A second, minimal seeded application in DRAFT status — mikro/#72 (Borradores chip + promote). */
function makeDraftApplication(): LoanApplication {
  const now = new Date();
  return {
    id: "e2e-app-draft-0001",
    sessionId: "e2e-session-draft-0001",
    status: "DRAFT",
    source: "FORM",
    lastSection: "solicitante",
    firstName: "Yolanda",
    lastName: "Fermín",
    phone: "+18095550199",
    idNumber: null,
    dateOfBirth: null,
    maritalStatus: null,
    businessType: null,
    businessName: null,
    requestedAmount: null,
    purpose: null,
    requestedTermWeeks: null,
    province: null,
    homeAddress: null,
    rawData: { firstName: "Yolanda", lastName: "Fermín", phone: "(809) 555-0199" },
    scoreData: null,
    score: null,
    riskBand: null,
    recommendation: null,
    scoredAt: null,
    reviewedById: null,
    reviewedAt: null,
    reviewNote: null,
    contractFilename: null,
    contractOriginalName: null,
    contractMimeType: null,
    contractSize: null,
    contractSha256: null,
    signedById: null,
    signedAt: null,
    idFrontFilename: null,
    idFrontOriginalName: null,
    idFrontMimeType: null,
    idFrontSize: null,
    idBackFilename: null,
    idBackOriginalName: null,
    idBackMimeType: null,
    idBackSize: null,
    idUploadedById: null,
    idUploadedAt: null,
    customerId: null,
    loanId: null,
    submittedAt: null,
    createdAt: now,
    updatedAt: now
  };
}

let applications: LoanApplication[] = [makeApplication(), makeDraftApplication()];

/** Rebuild the store (fresh app process should start clean). */
export function e2eResetStore(): void {
  applications = [makeApplication(), makeDraftApplication()];
}

/**
 * Internal: the live stored object (mutated by the write helpers). Reads/writes
 * that cross the tRPC boundary always return a *fresh clone* (below) so React
 * Query's structural sharing detects the change and re-renders — mirroring a
 * real server that returns a new row each response.
 */
function findApp(ref: { id?: string }): LoanApplication {
  const app = applications.find((a) => a.id === ref.id) ?? applications[0];
  if (!app) throw new Error("Loan application not found");
  return app;
}

export function e2eListApplications(status?: string): LoanApplication[] {
  const rows = status ? applications.filter((a) => a.status === status) : applications;
  return rows.map((a) => ({ ...a }));
}

export function e2eGetApplication(ref: { id?: string }): LoanApplication {
  return { ...findApp(ref) };
}

function toAmount(v: string): number | null {
  const digits = v.replace(/[^\d]/g, "");
  return digits ? Number(digits) : null;
}

function toWeeks(v: string): number | null {
  const m = v.match(/\d+/);
  return m ? Number(m[0]) : null;
}

/** Merge a patch over rawData and re-derive the columns the screens read back. */
export function e2eUpdateApplication(input: {
  id?: string;
  patch: Record<string, string>;
}): LoanApplication {
  const app = findApp(input);
  app.rawData = { ...(app.rawData as Record<string, unknown>), ...input.patch };
  const p = input.patch;
  if ("firstName" in p) app.firstName = p.firstName || null;
  if ("lastName" in p) app.lastName = p.lastName || null;
  if ("phone" in p) app.phone = p.phone || null;
  if ("idNumber" in p) app.idNumber = p.idNumber || null;
  if ("maritalStatus" in p) app.maritalStatus = p.maritalStatus || null;
  if ("businessType" in p) app.businessType = p.businessType || null;
  if ("businessName" in p) app.businessName = p.businessName || null;
  if ("purpose" in p) app.purpose = p.purpose || null;
  if ("province" in p) app.province = p.province || null;
  if ("homeAddress" in p) app.homeAddress = p.homeAddress || null;
  if ("requestedAmount" in p) app.requestedAmount = toAmount(p.requestedAmount);
  if ("requestedTermWeeks" in p) app.requestedTermWeeks = toWeeks(p.requestedTermWeeks);
  if ("dateOfBirth" in p) {
    const d = new Date(p.dateOfBirth);
    app.dateOfBirth = Number.isNaN(d.getTime()) ? null : d;
  }
  app.updatedAt = new Date();
  return { ...app };
}

export function e2eDeleteApplication(input: { id?: string }): { id: string } {
  const app = findApp(input);
  applications = applications.filter((a) => a.id !== app.id);
  return { id: app.id };
}

export function e2eSetIdImage(
  input: { id?: string; side: "FRONT" | "BACK" },
  present: boolean
): LoanApplication {
  const app = findApp(input);
  if (input.side === "FRONT") app.idFrontFilename = present ? "e2e-cedula-front.jpg" : null;
  else app.idBackFilename = present ? "e2e-cedula-back.jpg" : null;
  return { ...app };
}

export function e2eSetContract(input: { id?: string }, present: boolean): LoanApplication {
  const app = findApp(input);
  app.contractFilename = present ? "e2e-contrato.pdf" : null;
  return { ...app };
}

export function e2eSetStatus(
  input: { id?: string },
  status: LoanApplication["status"]
): LoanApplication {
  const app = findApp(input);
  app.status = status;
  app.reviewedById = REVIEWER_ID;
  return { ...app };
}

/** Send-promo stub (mikro/#68) — always succeeds so the mobile "Enviar promoción" flow round-trips. */
export function e2eSendPromo(): { sent: true; messageId: string } {
  return { sent: true, messageId: "e2e-promo-msg-1" };
}
