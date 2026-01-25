/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import phone from "phone";
import { z } from "zod/v4";
import { ValidationError } from "../errors/index.js";

/**
 * Validates and normalizes a Dominican Republic phone number.
 * Returns the phone number in E.164 format with the leading +.
 *
 * @param phoneNumber - The phone number to validate (can include or exclude +)
 * @returns The normalized phone number in E.164 format with + (e.g., "+18091234567")
 * @throws ValidationError if the phone number is invalid
 */
export function validateDominicanPhone(phoneNumber: string): string {
  // phone library expects country code as ISO2 (DO for Dominican Republic)
  const result = phone(phoneNumber, { country: "DO" });

  if (!result.isValid) {
    // Create a ZodError to match ValidationError's expected format
    const zodError = new z.ZodError([
      {
        code: z.ZodIssueCode.custom,
        path: ["phone"],
        message: "Phone number must be a valid Dominican Republic number"
      }
    ]);
    throw new ValidationError(zodError);
  }

  // Return the phone number in E.164 format
  // phone library returns e164 format like "+18091234567"
  // We keep the + for consistent storage and querying
  return result.phoneNumber;
}
