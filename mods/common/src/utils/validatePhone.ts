/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { phone } from "phone";
import { z } from "zod/v4";
import { ValidationError } from "../errors/index.js";

/**
 * Validates and normalizes an international phone number to E.164 format.
 * Returns the phone number in E.164 format with the leading +.
 * Accepts phone numbers from any country.
 *
 * @param phoneNumber - The phone number to validate (can include or exclude +)
 * @returns The normalized phone number in E.164 format with + (e.g., "+18091234567")
 * @throws ValidationError if the phone number is invalid
 */
export function validatePhone(phoneNumber: string): string {
  // Normalize: add + prefix if missing for international format
  const normalizedInput = phoneNumber.startsWith("+") ? phoneNumber : `+${phoneNumber}`;

  // phone library validates any international phone number when called without country restriction
  const result = phone(normalizedInput);

  if (!result.isValid) {
    // Create a ZodError to match ValidationError's expected format
    const zodError = new z.ZodError([
      {
        code: z.ZodIssueCode.custom,
        path: ["phone"],
        message: "Phone number must be a valid e164 format"
      }
    ]);
    throw new ValidationError(zodError);
  }

  // Return the phone number in E.164 format
  // phone library returns e164 format like "+18091234567"
  // We keep the + for consistent storage and querying
  return result.phoneNumber;
}
