/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  withErrorHandlingAndValidation,
  createCategorySchema,
  type CreateCategoryInput,
  type AccountingCategory
} from "@mikro/common";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { toCategory } from "./mappers.js";

export function createCreateCategory(client: PrismaClient) {
  const fn = async (params: CreateCategoryInput): Promise<AccountingCategory> => {
    const created = await client.accountingCategory.create({
      data: { name: params.name, kind: params.kind }
    });
    return toCategory(created);
  };
  return withErrorHandlingAndValidation(fn, createCategorySchema);
}
