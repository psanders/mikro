/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Human Spanish one-liner for a proposed write, shown on the confirm card above
 * the verbatim arguments (design Decision 3 / Risks). Best-effort: unknown tools
 * fall back to a generic description so a new write tool is never unlabelled.
 */

function str(args: Record<string, unknown>, key: string): string | undefined {
  const v = args[key];
  return v === undefined || v === null ? undefined : String(v);
}

/**
 * Build a Spanish summary of a write-tool call for the confirmation card.
 */
export function summarizeAction(toolName: string, args: Record<string, unknown>): string {
  switch (toolName) {
    case "createPayment": {
      const amount = str(args, "amount");
      const loanId = str(args, "loanId");
      return `Registrar un pago${amount ? ` de RD$${amount}` : ""}${
        loanId ? ` en el préstamo #${loanId}` : ""
      }.`;
    }
    case "createCustomer": {
      const name = str(args, "name");
      return `Crear el cliente${name ? ` ${name}` : ""}.`;
    }
    case "createLoan": {
      const principal = str(args, "principal");
      const customerId = str(args, "customerId");
      return `Crear un préstamo${principal ? ` de RD$${principal}` : ""}${
        customerId ? ` para el cliente ${customerId}` : ""
      }.`;
    }
    case "updateLoanStatus": {
      const loanId = str(args, "loanId");
      const status = str(args, "status");
      return `Cambiar el estado del préstamo${loanId ? ` #${loanId}` : ""}${
        status ? ` a ${status}` : ""
      }.`;
    }
    case "sendPromo": {
      const phone = str(args, "phone");
      return `Enviar la promoción por WhatsApp${phone ? ` al ${phone}` : ""}`;
    }
    case "approveApplication": {
      const id = str(args, "id");
      return `Aprobar la solicitud${id ? ` ${id}` : ""}.`;
    }
    case "rejectApplication": {
      const id = str(args, "id");
      const reason = str(args, "reason");
      return `Rechazar la solicitud${id ? ` ${id}` : ""}${reason ? ` por el motivo: ${reason}` : ""}.`;
    }
    case "deleteApplication": {
      const id = str(args, "id");
      return `Eliminar permanentemente la solicitud${id ? ` ${id}` : ""}.`;
    }
    case "forceQCobroSync":
      return "Forzar sincronización con QCobro ahora.";
    default:
      return `Ejecutar ${toolName} con los datos: ${JSON.stringify(args)}.`;
  }
}
