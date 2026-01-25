/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { ToolResult } from "../../llm/types.js";
import type { ToolExecutorDependencies } from "./types.js";
import { logger } from "../../logger.js";

export async function handleCreateMember(
  deps: ToolExecutorDependencies,
  args: Record<string, unknown>,
  context?: Record<string, unknown>
): Promise<ToolResult> {
  // Get phone from context (set by router based on WhatsApp sender)
  const phone = (context?.phone as string) || (args.phone as string);
  if (!phone) {
    return {
      success: false,
      message: "Phone number is required but not available in context"
    };
  }

  // Get referredById from args (LLM should have already obtained it using listUsers)
  const referredById = args.referredById as string | undefined;
  if (!referredById) {
    return {
      success: false,
      message:
        "Se requiere referredById. Pregunta al usuario '¿Quién te refirió?' y luego usa listUsers con role='REFERRER' para obtener la lista de referidores con sus IDs, haz coincidir el nombre, y usa el ID del referidor seleccionado."
    };
  }

  const member = await deps.createMember({
    name: args.name as string,
    phone,
    idNumber: args.idNumber as string,
    collectionPoint: args.collectionPoint as string,
    homeAddress: args.homeAddress as string,
    referredById,
    jobPosition: args.jobPosition as string | undefined,
    income: args.income ? Number(args.income) : undefined,
    isBusinessOwner: args.isBusinessOwner === "true" || args.isBusinessOwner === true
  });

  logger.verbose("member created via tool", { memberId: member.id });

  // Extract first name for friendly message
  const firstName = member.name.split(" ")[0];
  return {
    success: true,
    message: `Estimado ${firstName}, registramos su información y el equipo se pondrá en contacto pronto.`,
    data: { memberId: member.id, name: member.name }
  };
}
