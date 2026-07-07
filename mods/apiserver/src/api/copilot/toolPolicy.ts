/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * The copilot tool policy — the security model for the founder copilot
 * (design Decision 2). Three explicit lists partition every tool the model may
 * see:
 *
 *  - READ_TOOLS  execute inline during the loop and their result feeds back to
 *    the model (queries, reports, event-log queries, rule listing).
 *  - WRITE_TOOLS are NEVER executed inline: the loop intercepts the call,
 *    persists a CopilotPendingAction, and returns it for the founder to confirm.
 *  - DIRECT_TOOLS execute inline by design (low-risk, reversible watch-rule
 *    management), matching the Pencil flow where the rule card appears at once.
 *
 * A tool in none of the three lists is never bound to the model at all.
 */
import type { ToolFunction } from "@mikro/agents";
import { getToolByName } from "@mikro/agents";
import { listAutomationDescriptors } from "../../tasks/index.js";

/**
 * Query the append-only business-event log (the founder feed). A read tool: the
 * copilot uses it to answer "what happened" questions ("¿qué se borró esta
 * semana?").
 */
export const queryFeedEventsTool: ToolFunction = {
  type: "function",
  function: {
    name: "queryFeedEvents",
    description:
      "Consultar el registro de eventos de negocio (el feed). Devuelve los eventos más recientes con filtros opcionales por tipo, rango de fechas y límite. Útil para responder qué ha pasado (pagos, aprobaciones, borrados, alertas, etc.).",
    parameters: {
      type: "object",
      properties: {
        types: {
          type: "string",
          description:
            "Lista de tipos de evento separados por coma para filtrar (ej: 'payment.collected,application.deleted'). Opcional."
        },
        from: {
          type: "string",
          description: "Fecha de inicio del rango en formato YYYY-MM-DD. Opcional."
        },
        to: {
          type: "string",
          description: "Fecha de fin del rango en formato YYYY-MM-DD. Opcional."
        },
        limit: {
          type: "string",
          description: "Número máximo de eventos a devolver (por defecto 20, máximo 100). Opcional."
        }
      },
      required: []
    }
  }
};

/**
 * Today's total cash collected (mikro/#115). A read tool: wraps the same
 * `cobranza_diaria` computation the watch-rule evaluator uses, so the founder
 * can ask "¿cuánto se cobró hoy?" ad hoc during a books-closing conversation,
 * not just via a threshold alert.
 */
export const getDailyCashCollectedTool: ToolFunction = {
  type: "function",
  function: {
    name: "getDailyCashCollected",
    description:
      "Consultar el total de efectivo cobrado (suma de pagos no revertidos) en una fecha dada. Úsala cuando el fundador quiera cerrar el día y necesite comparar el total cobrado del sistema contra su conteo físico.",
    parameters: {
      type: "object",
      properties: {
        date: {
          type: "string",
          description: "Fecha en formato YYYY-MM-DD. Opcional, por defecto hoy."
        }
      },
      required: []
    }
  }
};

/**
 * Create a watch rule directly (design Decision 5). A DIRECT tool — executes
 * inline; the dock renders the rule card immediately.
 */
export const createWatchRuleTool: ToolFunction = {
  type: "function",
  function: {
    name: "createWatchRule",
    description:
      "Crear una regla de vigilancia que avisa cuando una métrica cruza un umbral. Se ejecuta directamente (sin confirmación) porque es reversible con Desactivar. La métrica DEBE ser una de: mora_pct_portfolio (% de préstamos activos con atraso), mora_pct_collector (igual pero por cobrador, requiere collectorId), cobranza_diaria (total cobrado hoy).",
    parameters: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Nombre corto y descriptivo de la regla (ej: 'Mora de la ruta de Juan')."
        },
        metric: {
          type: "string",
          description: "Métrica a vigilar.",
          enum: ["mora_pct_portfolio", "mora_pct_collector", "cobranza_diaria"]
        },
        comparator: {
          type: "string",
          description: "Comparador: 'gt' (mayor que el umbral) o 'lt' (menor que el umbral).",
          enum: ["gt", "lt"]
        },
        threshold: {
          type: "string",
          description:
            "Umbral numérico. Para métricas de porcentaje usa el número directo (ej: 9 para 9%)."
        },
        collectorId: {
          type: "string",
          description:
            "ID (UUID) del cobrador a vigilar. Obligatorio solo para la métrica mora_pct_collector."
        }
      },
      required: ["name", "metric", "comparator", "threshold"]
    }
  }
};

/**
 * List the founder's watch rules. A read tool.
 */
export const listWatchRulesTool: ToolFunction = {
  type: "function",
  function: {
    name: "listWatchRules",
    description:
      "Listar las reglas de vigilancia existentes. Por defecto solo las activas; usa includeDisabled='true' para incluir las desactivadas.",
    parameters: {
      type: "object",
      properties: {
        includeDisabled: {
          type: "string",
          description: "Si es 'true', incluye también las reglas desactivadas. Opcional."
        }
      },
      required: []
    }
  }
};

/**
 * Disable a watch rule. A DIRECT tool.
 */
export const disableWatchRuleTool: ToolFunction = {
  type: "function",
  function: {
    name: "disableWatchRule",
    description:
      "Desactivar una regla de vigilancia por su ID (UUID). Una regla desactivada deja de evaluarse y no produce más alertas.",
    parameters: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "ID (UUID) de la regla a desactivar."
        }
      },
      required: ["id"]
    }
  }
};

/**
 * File a GitHub issue mid-conversation (design Decision 4, issue #111): a bug,
 * a missing capability, or a UI/UX idea the copilot notices. A DIRECT tool —
 * executes inline, no confirmation gate, because filing an internal,
 * unlabeled issue isn't a business-data mutation (unlike WRITE_TOOLS) and is
 * trivially reversible. `reasoning` is required so every filed issue explains
 * *why* it matters, not just that something happened. `toolContext` is NOT a
 * model-supplied argument — the chat loop attaches the most recently failed
 * tool call in the same turn automatically, if there was one.
 */
export const githubFeedbackTool: ToolFunction = {
  type: "function",
  function: {
    name: "githubFeedback",
    description:
      "Registrar un bug, una capacidad faltante, o una idea de mejora de UI/UX como un issue de GitHub, en el momento en que lo notas durante la conversación. Úsalo para gaps reales que observas (una herramienta que no puede hacer lo que se le pide, una tarjeta del dashboard confusa o que falta, algo que rompió el flujo) — no lo uses como respuesta a una simple búsqueda sin resultados.",
    parameters: {
      type: "object",
      properties: {
        category: {
          type: "string",
          description: "Tipo de feedback.",
          enum: ["bug", "missing_capability", "ui_suggestion", "other"]
        },
        title: {
          type: "string",
          description: "Título corto y específico del issue (máx 120 caracteres)."
        },
        summary: {
          type: "string",
          description: "Resumen de una o dos frases de lo que ocurrió o de la idea."
        },
        reasoning: {
          type: "string",
          description:
            "Por qué esto importa — no solo qué pasó, sino el impacto o la oportunidad que representa."
        }
      },
      required: ["category", "title", "summary", "reasoning"]
    }
  }
};

/**
 * The automation catalog rendered into the createTask tool docs: id enum +
 * per-automation slot summary, so the model can only bind automations and
 * slots that exist (founder-tasks spec, "Model cannot invent an automation").
 */
function automationCatalogDoc(): { ids: string[]; doc: string } {
  const descriptors = listAutomationDescriptors();
  const doc = descriptors
    .map((d) => {
      const statics = d.slots
        .filter((s) => s.source === "static")
        .map((s) => `${s.name} (${s.label})`)
        .join(", ");
      const asks = d.slots
        .filter((s) => s.source === "ask")
        .map((s) => s.label)
        .join(", ");
      return `- ${d.id} ("${d.title}"): parámetros fijos: ${statics || "ninguno"}. Se pregunta al confirmar: ${asks || "nada"}.`;
    })
    .join("\n");
  return { ids: descriptors.map((d) => d.id), doc };
}

const catalogDoc = automationCatalogDoc();

/**
 * Create a scheduled task bound to a catalog automation. A DIRECT tool —
 * reversible config (pause/cancel), mirroring the watch-rule tools. Task
 * EXECUTION never touches the copilot loop.
 */
export const createTaskTool: ToolFunction = {
  type: "function",
  function: {
    name: "createTask",
    description:
      "Crear una tarea programada que dispara una automatización del catálogo (ej: 'recuérdame cada viernes a las 8am pagar al cobrador Luis'). Se ejecuta directamente porque es reversible (pausar/cancelar). La tarea aparece en el feed como tarjeta ámbar cuando vence; nada se ejecuta sin la confirmación del fundador cuando la automatización lo requiere. Catálogo:\n" +
      catalogDoc.doc +
      "\nPara los parámetros fijos de tipo cobrador/cuenta/categoría puedes pasar el UUID o el nombre exacto (se resuelve automáticamente).",
    parameters: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Nombre corto y descriptivo de la tarea (ej: 'Pago semanal Ana')."
        },
        automationId: {
          type: "string",
          description: "Automatización del catálogo a disparar.",
          enum: catalogDoc.ids
        },
        frequency: {
          type: "string",
          description:
            "Frecuencia: 'once' (una vez, requiere onDate), 'daily', 'weekly' (requiere weekday) o 'monthly' (requiere dayOfMonth).",
          enum: ["once", "daily", "weekly", "monthly"]
        },
        weekday: {
          type: "string",
          description: "Día de la semana para weekly: 0=domingo … 6=sábado."
        },
        dayOfMonth: {
          type: "string",
          description:
            "Día del mes (1-31) para monthly; se ajusta al último día si el mes es más corto."
        },
        onDate: {
          type: "string",
          description: "Fecha YYYY-MM-DD para once."
        },
        timeOfDay: {
          type: "string",
          description: "Hora HH:MM (24h) en hora de República Dominicana."
        },
        staticParams: {
          type: "object",
          description:
            "Parámetros fijos de la automatización elegida (ver catálogo). UUIDs o nombres exactos."
        }
      },
      required: ["name", "automationId", "frequency", "timeOfDay"]
    }
  }
};

/** List the founder's scheduled tasks. A read tool. */
export const listTasksTool: ToolFunction = {
  type: "function",
  function: {
    name: "listTasks",
    description:
      "Listar las tareas programadas existentes. Por defecto solo las activas; usa includeDisabled='true' para incluir las pausadas.",
    parameters: {
      type: "object",
      properties: {
        includeDisabled: {
          type: "string",
          description: "Si es 'true', incluye también las tareas pausadas. Opcional."
        }
      },
      required: []
    }
  }
};

/** Cancel (delete) a scheduled task. A DIRECT tool. */
export const cancelTaskTool: ToolFunction = {
  type: "function",
  function: {
    name: "cancelTask",
    description:
      "Cancelar (eliminar) una tarea programada por su ID (UUID). Una ocurrencia ya disparada y pendiente sigue siendo confirmable u omisible desde el feed.",
    parameters: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "ID (UUID) de la tarea a cancelar."
        }
      },
      required: ["id"]
    }
  }
};

/**
 * Single-loan health check (collections evaluation framework). A read tool: runs
 * the spec checks over the loan and, when `explain` is set, returns an LLM
 * narration of how the numbers were reached. Numbers are deterministic.
 */
export const getLoanHealthTool: ToolFunction = {
  type: "function",
  function: {
    name: "getLoanHealth",
    description:
      "Revisar la salud de un préstamo: corre las verificaciones de la especificación de cobros sobre el préstamo y devuelve el snapshot (términos + ledger crudo + números derivados) y el resultado de cada verificación. Con explain=true agrega una explicación en español de cómo se llegó a los números. Úsalo cuando el fundador pregunte por qué un préstamo muestra ciertos pagos pendientes, saldo o mora.",
    parameters: {
      type: "object",
      properties: {
        loanId: {
          type: "string",
          description: "Número de préstamo (loanId, ej: 10034)."
        },
        explain: {
          type: "string",
          description: "'true' para incluir la explicación narrada. Opcional (por defecto false)."
        }
      },
      required: ["loanId"]
    }
  }
};

/**
 * Portfolio-wide health check. A read tool: runs the spec checks over every loan
 * and returns the aggregate (pass/fail counts, per-check tally, worst offenders).
 */
export const runPortfolioHealthCheckTool: ToolFunction = {
  type: "function",
  function: {
    name: "runPortfolioHealthCheck",
    description:
      "Correr el chequeo de salud de toda la cartera: aplica las verificaciones de la especificación de cobros a todos los préstamos y devuelve un resumen (cuántos pasan/fallan, fallas por verificación, y los peores casos). Determinista, sin IA. Úsalo cuando el fundador quiera saber si los números de la cartera cuadran con la especificación.",
    parameters: {
      type: "object",
      properties: {
        includeAllStatuses: {
          type: "string",
          description:
            "'true' para revisar préstamos en cualquier estado (no solo ACTIVE). Opcional."
        }
      },
      required: []
    }
  }
};

/**
 * Tool definitions owned by the copilot module (not by the WhatsApp agents).
 * Handled inline by createCopilotChat rather than the shared tool executor.
 */
export const COPILOT_LOCAL_TOOLS: ToolFunction[] = [
  queryFeedEventsTool,
  getDailyCashCollectedTool,
  createWatchRuleTool,
  listWatchRulesTool,
  disableWatchRuleTool,
  githubFeedbackTool,
  createTaskTool,
  listTasksTool,
  cancelTaskTool,
  getLoanHealthTool,
  runPortfolioHealthCheckTool
];

/**
 * Read tools: execute inline, result feeds back to the model. A curated subset
 * of the existing list/get/report tools plus the copilot's own read tools.
 */
export const READ_TOOLS: readonly string[] = [
  "getCustomer",
  "getCustomerByPhone",
  "getApplicationById",
  "listLoansByCustomer",
  "listCustomerLoansByPhone",
  "listPaymentsByLoanId",
  "getLoanByLoanId",
  "listUsers",
  "calculateLoan",
  "previewLateFee",
  "exportAllCustomers",
  "generatePerformanceReport",
  "generateDefaultedReport",
  "generateRenewalCandidatesReport",
  "queryFeedEvents",
  "getDailyCashCollected",
  "listWatchRules",
  "listTasks",
  "getLoanHealth",
  "runPortfolioHealthCheck"
];

/**
 * Write tools: business writes. NEVER executed inline — a call short-circuits
 * the loop into a pending action the founder must confirm.
 */
export const WRITE_TOOLS: readonly string[] = [
  "createPayment",
  "createCustomer",
  "createLoan",
  "updateLoanStatus",
  "sendPromo",
  "approveApplication",
  "rejectApplication",
  "deleteApplication",
  "forceQCobroSync",
  "sendReceiptViaWhatsApp",
  "createAccountingTransaction"
];

/**
 * Direct tools: executed inline, no confirmation. Watch-rule management is
 * reversible business config; githubFeedback is an external, non-business
 * side effect (an internal issue, not a mutation) — issue #111 explicitly
 * asks for it to be callable in the moment, which a confirm-first flow would
 * defeat.
 */
export const DIRECT_TOOLS: readonly string[] = [
  "createWatchRule",
  "disableWatchRule",
  "githubFeedback",
  // Task definitions are reversible config (pause/cancel) like watch rules;
  // execution is gated separately by the firing confirm flow, never here.
  "createTask",
  "cancelTask"
];

/** Copilot-local tool names — handled by createCopilotChat, not the executor. */
export const LOCAL_TOOL_NAMES: readonly string[] = COPILOT_LOCAL_TOOLS.map((t) => t.function.name);

/**
 * Hand-curated disambiguation notes for tools whose inputs could otherwise be
 * confused with one another (design Decision 3, environment/tool-capability
 * awareness). Deliberately small — NOT an attempt to auto-document every
 * bound tool (the model already gets full param schemas via bindTools). Only
 * add an entry here when two bound tools could plausibly resolve the same
 * kind of user input, the way a customer UUID and a solicitud UUID look
 * identical but come from different tables.
 */
export const TOOL_NOTES: Record<string, string> = {
  getCustomer: "usa el UUID del cliente; para solicitudes usa getApplicationById, no este.",
  getApplicationById: "usa el UUID de la solicitud, no el del cliente.",
  listCustomerLoansByPhone:
    "para ubicar un cliente y sus préstamos por teléfono, prefiere esta sobre encadenar getCustomerByPhone + listLoansByCustomer.",
  createAccountingTransaction:
    "account, toAccount y category aceptan el nombre exacto (ej: 'Caja principal') o el UUID; se resuelve automáticamente. No la confundas con createPayment (cobro de un préstamo) — esta es una entrada contable independiente."
};

export function isReadTool(name: string): boolean {
  return READ_TOOLS.includes(name);
}

export function isWriteTool(name: string): boolean {
  return WRITE_TOOLS.includes(name);
}

export function isDirectTool(name: string): boolean {
  return DIRECT_TOOLS.includes(name);
}

export function isLocalTool(name: string): boolean {
  return LOCAL_TOOL_NAMES.includes(name);
}

/**
 * The exact set of tool definitions bound to the copilot model: read + write +
 * direct. Any tool outside these lists is never bound and therefore uncallable.
 * Definitions come from the copilot-local set first, then the shared agents
 * registry.
 */
export function getCopilotToolDefinitions(): ToolFunction[] {
  const local = new Map(COPILOT_LOCAL_TOOLS.map((t) => [t.function.name, t]));
  const names = [...READ_TOOLS, ...WRITE_TOOLS, ...DIRECT_TOOLS];
  return names
    .map((name) => local.get(name) ?? getToolByName(name))
    .filter((tool): tool is ToolFunction => tool !== undefined);
}

/** Names of every tool bound to the model (the union of the three lists). */
export function getBoundToolNames(): string[] {
  return getCopilotToolDefinitions().map((t) => t.function.name);
}
