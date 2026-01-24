/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { z } from "zod/v4";
import { ValidationError } from "../errors/ValidationError.js";

/**
 * Wraps a function with Zod schema validation and error handling.
 *
 * @param fn - The async function to wrap. Receives validated/typed parameters.
 * @param schema - The Zod schema to validate input against.
 * @returns A wrapped function that validates input before execution.
 *
 * @throws {ValidationError} When input fails schema validation.
 *
 * @example
 * ```typescript
 * const createMember = withErrorHandlingAndValidation(
 *   async (params: CreateMemberInput) => {
 *     return db.member.create({ data: params });
 *   },
 *   createMemberSchema
 * );
 *
 * // Usage - throws ValidationError if input is invalid
 * const member = await createMember({ name: "John", ... });
 * ```
 */
export function withErrorHandlingAndValidation<TSchema extends z.ZodType, TResult>(
  fn: (params: z.infer<TSchema>) => Promise<TResult>,
  schema: TSchema
): (params: unknown) => Promise<TResult> {
  return async (params: unknown) => {
    const result = schema.safeParse(params);

    if (!result.success) {
      throw new ValidationError(result.error);
    }

    return fn(result.data);
  };
}
