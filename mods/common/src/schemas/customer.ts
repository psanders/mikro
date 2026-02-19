/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { z } from "zod/v4";
import { validatePhone } from "../utils/validatePhone.js";

const dayOfWeekEnum = z.enum([
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY"
]);

/**
 * Schema for creating a new customer.
 */
export const createCustomerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z
    .string()
    .min(1, "Phone is required")
    .transform((val) => {
      // Validate and normalize phone to E.164 format
      return validatePhone(val);
    }),
  idNumber: z
    .string()
    .min(1, "ID number is required")
    .regex(/^\d{3}-\d{7}-\d{1}$/, "ID number must be in format 000-0000000-0"),
  collectionPoint: z.string().url("Collection point must be a valid URL").optional(),
  homeAddress: z.string().min(1, "Home address is required"),
  jobPosition: z.string().optional(),
  income: z.number().optional(),
  isBusinessOwner: z.boolean().optional(),
  createdById: z.uuid().optional(),
  referredById: z.uuid({ error: "Invalid referrer ID" }),
  assignedCollectorId: z.uuid({ error: "Invalid collector ID" }).optional(),
  isActive: z.boolean().default(true),
  notes: z.string().optional(),
  preferredPaymentDay: dayOfWeekEnum.nullable().default(null)
});

/**
 * Schema for updating an existing customer.
 * Only name, phone, notes, isActive, and preferredPaymentDay can be updated.
 */
export const updateCustomerSchema = z.object({
  id: z.uuid({ error: "Invalid customer ID" }),
  name: z.string().min(1, "Name is required").optional(),
  phone: z
    .string()
    .min(1, "Phone is required")
    .transform((val) => {
      // Validate and normalize phone (strips +)
      return validatePhone(val);
    })
    .optional(),
  notes: z.string().optional(),
  isActive: z.boolean().optional(),
  preferredPaymentDay: dayOfWeekEnum.optional().nullable()
});

/**
 * Schema for getting a customer by ID.
 */
export const getCustomerSchema = z.object({
  id: z.uuid({ error: "Invalid customer ID" })
});

/**
 * Schema for getting a customer by phone number.
 */
export const getCustomerByPhoneSchema = z.object({
  phone: z
    .string()
    .min(1, "Phone number is required")
    .transform((val) => {
      // Validate and normalize phone to E.164 format
      return validatePhone(val);
    })
});

/**
 * Schema for listing customers with optional pagination.
 * By default only shows active customers unless showInactive is true.
 */
export const listCustomersSchema = z.object({
  showInactive: z.boolean().optional(), // If true, show all customers including inactive
  limit: z.number().int().positive().max(100).optional(),
  offset: z.number().int().nonnegative().optional()
});

/**
 * Schema for listing customers by referrer.
 * By default only shows active customers unless showInactive is true.
 */
export const listCustomersByReferrerSchema = z.object({
  referredById: z.uuid({ error: "Invalid referrer ID" }),
  showInactive: z.boolean().optional(),
  limit: z.number().int().positive().max(100).optional(),
  offset: z.number().int().nonnegative().optional()
});

/**
 * Schema for listing customers by collector.
 * By default only shows active customers unless showInactive is true.
 */
export const listCustomersByCollectorSchema = z.object({
  assignedCollectorId: z.uuid({ error: "Invalid collector ID" }),
  showInactive: z.boolean().optional(),
  limit: z.number().int().positive().max(100).optional(),
  offset: z.number().int().nonnegative().optional()
});

/**
 * Schema for exporting collector customers.
 * Returns customers with loans, referrer, and payment status for report generation.
 */
export const exportCollectorCustomersSchema = z.object({
  assignedCollectorId: z.uuid({ error: "Invalid collector ID" })
});

/**
 * Schema for exporting customers by referrer.
 * Returns customers referred by a specific user with loans and payment status.
 */
export const exportCustomersByReferrerSchema = z.object({
  referredById: z.uuid({ error: "Invalid referrer ID" })
});

/**
 * Schema for exporting all customers (admin only).
 * Returns all active customers with loans and payment status.
 */
export const exportAllCustomersSchema = z.object({});

/**
 * Input type for creating a customer.
 */
export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;

/**
 * Input type for updating a customer.
 */
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;

/**
 * Input type for getting a customer.
 */
export type GetCustomerInput = z.infer<typeof getCustomerSchema>;

/**
 * Input type for getting a customer by phone.
 */
export type GetCustomerByPhoneInput = z.infer<typeof getCustomerByPhoneSchema>;

/**
 * Input type for listing customers.
 */
export type ListCustomersInput = z.infer<typeof listCustomersSchema>;

/**
 * Input type for listing customers by referrer.
 */
export type ListCustomersByReferrerInput = z.infer<typeof listCustomersByReferrerSchema>;

/**
 * Input type for listing customers by collector.
 */
export type ListCustomersByCollectorInput = z.infer<typeof listCustomersByCollectorSchema>;

/**
 * Input type for exporting collector customers.
 */
export type ExportCollectorCustomersInput = z.infer<typeof exportCollectorCustomersSchema>;

/**
 * Input type for exporting customers by referrer.
 */
export type ExportCustomersByReferrerInput = z.infer<typeof exportCustomersByReferrerSchema>;

/**
 * Input type for exporting all customers.
 */
export type ExportAllCustomersInput = z.infer<typeof exportAllCustomersSchema>;
