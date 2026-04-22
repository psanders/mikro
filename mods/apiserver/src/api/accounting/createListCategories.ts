/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  withErrorHandlingAndValidation,
  listCategoriesSchema,
  type ListCategoriesInput,
  type AccountingCategory
} from "@mikro/common";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { toCategory } from "./mappers.js";

export function createListCategories(client: PrismaClient) {
  const fn = async (params: ListCategoriesInput): Promise<AccountingCategory[]> => {
    const categories = await client.accountingCategory.findMany({
      where: params.kind ? { kind: params.kind } : undefined,
      orderBy: { name: "asc" }
    });
    return categories.map(toCategory);
  };
  return withErrorHandlingAndValidation(fn, listCategoriesSchema);
}
