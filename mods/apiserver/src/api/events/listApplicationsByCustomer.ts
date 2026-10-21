/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  SEARCHABLE_APPLICATION_STATUSES,
  ValidationError,
  listApplicationsByCustomerSchema,
  type ListApplicationsByCustomerInput
} from "@mikro/common";
import { TRPCError } from "@trpc/server";
import type { EventClient } from "./recordEvent.js";
import type { ApplicationSearchHit } from "./searchApplications.js";

/**
 * A customer's past applications worth showing in their profile, newest first:
 * the one that became them (`customerId`) and any other that carries the same
 * cédula (a prospect who applied before being created as a customer, or again
 * later). DRAFT and ABANDONED are left out, as in search.
 */
export function createListApplicationsByCustomer(client: EventClient) {
  return async (raw: ListApplicationsByCustomerInput): Promise<ApplicationSearchHit[]> => {
    const parsed = listApplicationsByCustomerSchema.safeParse(raw);
    if (!parsed.success) throw new ValidationError(parsed.error);
    const customer = await client.customer.findUnique({
      where: { id: parsed.data.customerId },
      select: { id: true, idNumber: true }
    });
    if (!customer) throw new TRPCError({ code: "NOT_FOUND", message: "El cliente no existe." });

    return client.loanApplication.findMany({
      where: {
        status: { in: [...SEARCHABLE_APPLICATION_STATUSES] },
        OR: [{ customerId: customer.id }, { idNumber: customer.idNumber }]
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        businessName: true,
        phone: true,
        idNumber: true,
        status: true,
        customerId: true,
        createdAt: true
      },
      orderBy: { createdAt: "desc" }
    });
  };
}
