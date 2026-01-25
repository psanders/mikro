/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Tool executor that delegates tool calls to API functions.
 */
import type { ToolResult, ToolExecutor } from "../llm/types.js";
import { logger } from "../logger.js";
import { validatePhone } from "@mikro/common";

/**
 * API functions required by the tool executor.
 */
export interface ToolExecutorDependencies {
  /** Create a new member */
  createMember: (params: {
    name: string;
    phone: string;
    idNumber: string;
    collectionPoint: string;
    homeAddress: string;
    referredById: string;
    assignedCollectorId?: string;
    jobPosition?: string;
    income?: number;
    isBusinessOwner?: boolean;
  }) => Promise<{ id: string; name: string; phone: string }>;

  /** List users with optional role filter */
  listUsers: (params?: { role?: "ADMIN" | "COLLECTOR" | "REFERRER" }) => Promise<
    Array<{
      id: string;
      name: string;
      phone: string;
      roles?: Array<{ role: string }>;
    }>
  >;

  /** Create a payment */
  createPayment: (params: {
    loanId: string;
    amount: number;
    collectedById?: string;
    notes?: string;
  }) => Promise<{ id: string; amount: number }>;

  /** Generate a receipt */
  generateReceipt: (params: { paymentId: string }) => Promise<{ image: string; token: string }>;

  /** List loans by collector */
  listLoansByCollector: (params: {
    assignedCollectorId: string;
    showAll?: boolean;
  }) => Promise<Array<{ id: string; loanId: number; principal: number; status: string }>>;

  /** Get member by ID */
  getMember: (params: {
    id: string;
  }) => Promise<{ id: string; name: string; phone: string } | null>;

  /** Create a loan */
  createLoan: (params: {
    memberId: string;
    principal: number;
    termLength: number;
    paymentAmount: number;
    paymentFrequency: "WEEKLY" | "DAILY";
  }) => Promise<{ id: string; loanId: number }>;

  /** Get member by phone number */
  getMemberByPhone: (params: {
    phone: string;
  }) => Promise<{ id: string; name: string; phone: string } | null>;

  /** List loans by member ID */
  listLoansByMember: (params: {
    memberId: string;
    showAll?: boolean;
  }) => Promise<Array<{ id: string; loanId: number; principal: number; status: string }>>;
}

/**
 * Creates a tool executor that delegates to the provided API functions.
 *
 * @param deps - The API functions to use for tool execution
 * @returns A ToolExecutor function
 *
 * @example
 * ```typescript
 * const toolExecutor = createToolExecutor({
 *   createMember: createCreateMember(db),
 *   createPayment: createCreatePayment(db),
 *   // ... other API functions
 * });
 *
 * const result = await toolExecutor("createMember", { name: "John" }, { phone: "+123" });
 * ```
 */
export function createToolExecutor(deps: ToolExecutorDependencies): ToolExecutor {
  return async function executeTool(
    toolName: string,
    args: Record<string, unknown>,
    context?: Record<string, unknown>
  ): Promise<ToolResult> {
    logger.verbose("executing tool", { tool: toolName, args });

    try {
      switch (toolName) {
        case "createMember": {
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

        case "createPayment": {
          // Get collector ID from context
          const collectedById = context?.userId as string | undefined;

          const payment = await deps.createPayment({
            loanId: args.loanId as string,
            amount: Number(args.amount),
            collectedById,
            notes: args.notes as string | undefined
          });

          logger.verbose("payment created via tool", { paymentId: payment.id });
          return {
            success: true,
            message: `Pago de RD$ ${payment.amount} registrado correctamente.`,
            data: { paymentId: payment.id, amount: payment.amount }
          };
        }

        case "generateReceipt": {
          const receipt = await deps.generateReceipt({
            paymentId: args.paymentId as string
          });

          logger.verbose("receipt generated via tool", { paymentId: args.paymentId });
          return {
            success: true,
            message: "Recibo generado correctamente.",
            data: { image: receipt.image, token: receipt.token }
          };
        }

        case "listLoansByCollector": {
          // Get collector ID from context
          const collectorId = context?.userId as string;
          if (!collectorId) {
            return {
              success: false,
              message: "Collector ID is required but not available in context"
            };
          }

          const loans = await deps.listLoansByCollector({
            assignedCollectorId: collectorId,
            showAll: args.showAll === "true" || args.showAll === true
          });

          logger.verbose("loans listed via tool", { count: loans.length });
          return {
            success: true,
            message: `Se encontraron ${loans.length} préstamos.`,
            data: { loans }
          };
        }

        case "getMember": {
          const member = await deps.getMember({
            id: args.memberId as string
          });

          if (!member) {
            return {
              success: false,
              message: `Miembro no encontrado: ${args.memberId}`
            };
          }

          logger.verbose("member retrieved via tool", { memberId: member.id });
          return {
            success: true,
            message: "Información del miembro obtenida.",
            data: { member }
          };
        }

        case "createLoan": {
          const loan = await deps.createLoan({
            memberId: args.memberId as string,
            principal: Number(args.principal),
            termLength: Number(args.termLength),
            paymentAmount: Number(args.paymentAmount),
            paymentFrequency: args.paymentFrequency as "WEEKLY" | "DAILY"
          });

          logger.verbose("loan created via tool", { loanId: loan.loanId });
          return {
            success: true,
            message: `Préstamo creado con número ${loan.loanId}.`,
            data: { loanId: loan.loanId, id: loan.id }
          };
        }

        case "getMemberByPhone": {
          // Normalize phone number
          const phoneInput = args.phone as string;
          const normalizedPhone = validatePhone(phoneInput);

          const member = await deps.getMemberByPhone({
            phone: normalizedPhone
          });

          if (!member) {
            return {
              success: false,
              message: `Miembro no encontrado con el teléfono: ${phoneInput}`
            };
          }

          logger.verbose("member retrieved via tool by phone", {
            memberId: member.id,
            phone: normalizedPhone
          });
          return {
            success: true,
            message: "Información del miembro obtenida.",
            data: { member }
          };
        }

        case "listLoansByMember": {
          const loans = await deps.listLoansByMember({
            memberId: args.memberId as string,
            showAll: args.showAll === "true" || args.showAll === true
          });

          logger.verbose("loans listed via tool by member", {
            memberId: args.memberId,
            count: loans.length
          });
          return {
            success: true,
            message: `Se encontraron ${loans.length} préstamos para el miembro.`,
            data: { loans }
          };
        }

        case "listMemberLoansByPhone": {
          // Normalize phone number
          const phoneInput = args.phone as string;
          const normalizedPhone = validatePhone(phoneInput);

          // First get the member by phone
          const member = await deps.getMemberByPhone({
            phone: normalizedPhone
          });

          if (!member) {
            return {
              success: false,
              message: `Miembro no encontrado con el teléfono: ${phoneInput}`
            };
          }

          // Then list loans for that member
          const loans = await deps.listLoansByMember({
            memberId: member.id,
            showAll: args.showAll === "true" || args.showAll === true
          });

          logger.verbose("loans listed via tool by phone", {
            phone: normalizedPhone,
            memberId: member.id,
            count: loans.length
          });
          return {
            success: true,
            message: `Se encontraron ${loans.length} préstamos para ${member.name}.`,
            data: { member, loans }
          };
        }

        case "listUsers": {
          const role = args.role as "ADMIN" | "COLLECTOR" | "REFERRER" | undefined;
          const users = await deps.listUsers(role ? { role } : undefined);

          logger.verbose("users listed via tool", { role, count: users.length });

          if (users.length === 0) {
            const roleMsg = role ? ` con rol ${role}` : "";
            return {
              success: true,
              message: `No se encontraron usuarios${roleMsg} en el sistema.`,
              data: { users: [] }
            };
          }

          // Format users for display
          const usersList = users
            .map((u) => {
              const roles = u.roles?.map((r) => r.role).join(", ") || "Sin roles";
              return `- ${u.name} (ID: ${u.id}, Tel: ${u.phone}, Roles: ${roles})`;
            })
            .join("\n");

          const roleMsg = role ? ` con rol ${role}` : "";
          return {
            success: true,
            message: `Usuarios disponibles${roleMsg}:\n${usersList}`,
            data: { users }
          };
        }

        default:
          logger.warn("unknown tool called", { tool: toolName });
          return {
            success: false,
            message: `Herramienta desconocida: ${toolName}`
          };
      }
    } catch (error) {
      const err = error as Error;
      logger.error("tool execution failed", { tool: toolName, error: err.message });
      return {
        success: false,
        message: `Error al ejecutar ${toolName}: ${err.message}`
      };
    }
  };
}
