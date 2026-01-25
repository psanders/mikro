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
    loanId: number; // Numeric loanId - function converts to UUID internally
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

  /** Get loan by numeric loan ID */
  getLoanByLoanId: (params: { loanId: number }) => Promise<{
    id: string; // UUID
    loanId: number; // Numeric loan ID
    principal: number;
    termLength: number;
    paymentAmount: number;
    paymentFrequency: string;
    status: string;
    member: {
      id: string;
      name: string;
      phone: string;
      assignedCollectorId: string | null; // Required for validation
    };
  } | null>;
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
          const collectorId = context?.userId as string | undefined;
          if (!collectorId) {
            return {
              success: false,
              message: "Collector ID is required but not available in context"
            };
          }

          // Parse numeric loanId from string (e.g., "10000" -> 10000)
          const loanIdInput = args.loanId as string;
          const numericLoanId = Number(loanIdInput);
          if (isNaN(numericLoanId) || numericLoanId <= 0) {
            return {
              success: false,
              message: `ID de préstamo inválido: ${loanIdInput}. Debe ser un número positivo (ej: 10000, 10001).`
            };
          }

          // Get loan by numeric loanId (includes member with assignedCollectorId)
          const loan = await deps.getLoanByLoanId({
            loanId: numericLoanId
          });

          if (!loan) {
            return {
              success: false,
              message: `Préstamo no encontrado con ID: ${numericLoanId}`
            };
          }

          // Validate loan is active
          if (loan.status !== "ACTIVE") {
            return {
              success: false,
              message: `El préstamo ${numericLoanId} no está activo. Estado actual: ${loan.status}`
            };
          }

          // Validate collector assignment
          if (!loan.member.assignedCollectorId) {
            return {
              success: false,
              message: "Este préstamo no tiene un cobrador asignado"
            };
          }

          if (loan.member.assignedCollectorId !== collectorId) {
            return {
              success: false,
              message:
                "No tienes permiso para registrar pagos para este préstamo. Este préstamo está asignado a otro cobrador."
            };
          }

          // Parse payment amount
          const amount = Number(args.amount);
          if (isNaN(amount) || amount <= 0) {
            return {
              success: false,
              message: `Monto de pago inválido: ${args.amount}. Debe ser un número positivo.`
            };
          }

          // Create payment using numeric loanId - createPayment will handle UUID conversion internally
          const payment = await deps.createPayment({
            loanId: numericLoanId, // Numeric loanId - createPayment converts to UUID internally
            amount,
            collectedById: collectorId,
            notes: args.notes as string | undefined
          });

          logger.verbose("payment created via tool", {
            paymentId: payment.id,
            loanId: loan.loanId,
            collectorId
          });

          // Generate receipt
          let receipt;
          try {
            receipt = await deps.generateReceipt({
              paymentId: payment.id
            });
            logger.verbose("receipt generated via tool", {
              paymentId: payment.id
            });
          } catch (error) {
            const err = error as Error;
            logger.error("receipt generation failed in createPayment", {
              paymentId: payment.id,
              error: err.message
            });
            // Payment was created, but receipt generation failed
            return {
              success: true,
              message: `Pago de RD$ ${payment.amount} registrado correctamente, pero hubo un error al generar el recibo. Puedes generar el recibo más tarde usando generateReceipt con el paymentId: ${payment.id}`,
              data: {
                paymentId: payment.id,
                amount: payment.amount,
                loan: {
                  loanId: loan.loanId,
                  principal: loan.principal,
                  termLength: loan.termLength,
                  paymentAmount: loan.paymentAmount,
                  paymentFrequency: loan.paymentFrequency,
                  status: loan.status
                },
                member: {
                  id: loan.member.id,
                  name: loan.member.name,
                  phone: loan.member.phone
                }
              }
            };
          }

          // Format success message
          const successMessage = `Pago registrado para ${loan.member.name}\n\nPréstamo #${loan.loanId}\nMonto: RD$ ${amount.toLocaleString("es-DO")}\nRecibo generado correctamente`;

          return {
            success: true,
            message: successMessage,
            data: {
              paymentId: payment.id,
              amount: payment.amount,
              receipt: {
                image: receipt.image,
                token: receipt.token
              },
              loan: {
                loanId: loan.loanId,
                principal: loan.principal,
                termLength: loan.termLength,
                paymentAmount: loan.paymentAmount,
                paymentFrequency: loan.paymentFrequency,
                status: loan.status
              },
              member: {
                id: loan.member.id,
                name: loan.member.name,
                phone: loan.member.phone
              }
            }
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
