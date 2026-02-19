/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { z } from "zod/v4";

/**
 * Schema for creating a loan note.
 * createdById is the user recording the note (same pattern as payment collectedById).
 */
export const createLoanNoteSchema = z.object({
  loanId: z.number().int().positive("Loan ID must be a positive integer"),
  content: z.string().min(1, "Note content is required"),
  createdById: z.uuid({ message: "Creator user ID is required and must be a valid UUID" })
});

/**
 * Schema for listing notes by loan (numeric loan ID).
 */
export const listLoanNotesByLoanSchema = z.object({
  loanId: z.number().int().positive("Loan ID must be a positive integer")
});

export type CreateLoanNoteInput = z.infer<typeof createLoanNoteSchema>;
export type ListLoanNotesByLoanInput = z.infer<typeof listLoanNotesByLoanSchema>;
