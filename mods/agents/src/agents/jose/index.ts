/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { Agent } from "../../llm/types.js";
import { JOSE_SYSTEM_PROMPT } from "./systemPrompt.js";

export { JOSE_SYSTEM_PROMPT } from "./systemPrompt.js";

const INITIAL_FILLED = {
  firstName: "Juan",
  lastName: "Pérez",
  phone: "+18091234567",
  requestedAmount: 25000,
  requestedTermWeeks: 12,
  province: "Puerto Plata",
  businessType: "Colmado"
};

function saveAnswerMock(saved: string[], isc: number, missingFields: string[]) {
  return {
    success: true,
    message: `Campos guardados: ${saved.join(", ")}`,
    data: {
      saved,
      invalid: [],
      simulatedIsc: isc,
      isOutOfZone: false,
      isCriticalBusiness: false,
      missingFields
    }
  };
}

function finalizedMock() {
  return { success: true, message: "Solicitud finalizada", data: { finalized: true } };
}

const CLOSING_MSG =
  "¡Listo! Tu información está completa. Un asesor de Mikro la revisará y te contactará en horario laboral (lunes a viernes). Si nos escribes en fin de semana, respondemos el lunes. ¡Gracias por tu interés!";

export const jose: Agent = {
  name: "jose",
  systemPrompt: JOSE_SYSTEM_PROMPT,
  allowedTools: ["getApplicationState", "saveAnswer", "finalizeApplication"],
  temperature: 0.3,
  evaluations: {
    context: {
      sessionId: "session-test-001",
      phone: "+18091234567"
    },
    scenarios: [
      {
        id: "happy-path-full",
        description:
          "Prospect fills missing fields turn by turn; ISC never reaches 80; José finalizes once all fields are collected",
        turns: [
          {
            human: "Hola",
            // invokeLLM returns the pre-tool-call greeting text; the post-tool question is discarded.
            // Expected must match the greeting the AI generates before calling getApplicationState.
            expectedAI:
              "¡Hola! Soy José de Mikro Créditos. Veo que comenzaste una solicitud de préstamo. Déjame revisar tu información para ayudarte a completarla.",
            tools: [
              {
                name: "getApplicationState",
                mockResponse: {
                  success: true,
                  message: "Estado de solicitud obtenido",
                  data: {
                    sessionId: "session-test-001",
                    filledFields: INITIAL_FILLED,
                    missingFields: [
                      "monthlySales",
                      "businessAge",
                      "formalization",
                      "locationType",
                      "employeeCount",
                      "housingType",
                      "residenceTime",
                      "homeAddress",
                      "addressReference",
                      "referenceName",
                      "referencePhone",
                      "idNumber",
                      "dateOfBirth",
                      "maritalStatus",
                      "purpose",
                      "businessName",
                      "businessPhone"
                    ],
                    simulatedIsc: 42,
                    isOutOfZone: false,
                    isCriticalBusiness: false
                  }
                }
              }
            ]
          },
          {
            human: "Vendo como 80 mil pesos al mes.",
            expectedAI: "Perfecto. ¿Cuánto tiempo llevas con tu negocio?",
            tools: [
              {
                name: "saveAnswer",
                mockResponse: saveAnswerMock(["monthlySales"], 65, [
                  "businessAge",
                  "formalization",
                  "locationType",
                  "employeeCount",
                  "housingType",
                  "residenceTime",
                  "homeAddress",
                  "referenceName",
                  "referencePhone"
                ])
              }
            ]
          },
          {
            human: "Tengo 3 años con el negocio",
            expectedAI:
              "Excelente. ¿Tu negocio está formalizado? (Informal sin RNC, Informal con RNC o Formal con RNC)",
            tools: [
              {
                name: "saveAnswer",
                mockResponse: saveAnswerMock(["businessAge"], 71, [
                  "formalization",
                  "locationType",
                  "employeeCount",
                  "housingType",
                  "residenceTime",
                  "homeAddress",
                  "referenceName",
                  "referencePhone"
                ])
              }
            ]
          },
          {
            human: "Informal con RNC",
            expectedAI:
              "Entendido, informal con RNC. ¿Dónde operas tu negocio? (Local propio, Local alquilado, Mercado o feria, Ambulante o Desde el hogar)",
            tools: [
              {
                name: "saveAnswer",
                mockResponse: saveAnswerMock(["formalization"], 74, [
                  "locationType",
                  "employeeCount",
                  "housingType",
                  "residenceTime",
                  "homeAddress",
                  "referenceName",
                  "referencePhone"
                ])
              }
            ]
          },
          {
            human: "Local alquilado",
            expectedAI:
              "Perfecto, local alquilado. ¿Cuántos empleados tienes? (Solo yo, 1 a 2, 3 a 5 o Más de 5)",
            tools: [
              {
                name: "saveAnswer",
                mockResponse: saveAnswerMock(["locationType"], 76, [
                  "employeeCount",
                  "housingType",
                  "residenceTime",
                  "homeAddress",
                  "referenceName",
                  "referencePhone"
                ])
              }
            ]
          },
          {
            human: "Solo yo",
            expectedAI: "Entendido, trabajas solo. ¿Tu casa es propia, alquilada o familiar?",
            tools: [
              {
                name: "saveAnswer",
                mockResponse: saveAnswerMock(["employeeCount"], 77, [
                  "housingType",
                  "residenceTime",
                  "homeAddress",
                  "referenceName",
                  "referencePhone"
                ])
              }
            ]
          },
          {
            human: "Casa propia",
            expectedAI: "Muy bien. ¿Cuánto tiempo llevas viviendo ahí?",
            tools: [
              {
                name: "saveAnswer",
                mockResponse: saveAnswerMock(["housingType"], 79, [
                  "residenceTime",
                  "homeAddress",
                  "referenceName",
                  "referencePhone"
                ])
              }
            ]
          },
          {
            human: "Más de 5 años",
            expectedAI: CLOSING_MSG,
            tools: [
              {
                name: "saveAnswer",
                mockResponse: saveAnswerMock(["residenceTime"], 82, [])
              },
              {
                name: "finalizeApplication",
                mockResponse: finalizedMock()
              }
            ]
          }
        ]
      },
      {
        id: "early-exit-score-80",
        description:
          "saveAnswer returns simulatedIsc >= 80; José finalizes immediately without asking more questions",
        turns: [
          {
            human: "Hola quiero completar mi solicitud",
            expectedAI:
              "¡Hola! Soy José de Mikro Créditos. Voy a revisar tu solicitud para ayudarte a completarla.",
            tools: [
              {
                name: "getApplicationState",
                mockResponse: {
                  success: true,
                  message: "Estado de solicitud obtenido",
                  data: {
                    sessionId: "session-test-001",
                    filledFields: {
                      firstName: "María",
                      province: "Puerto Plata",
                      businessType: "Salón de belleza",
                      requestedAmount: 15000,
                      requestedTermWeeks: 8
                    },
                    missingFields: ["monthlySales", "businessAge", "formalization"],
                    simulatedIsc: 48,
                    isOutOfZone: false,
                    isCriticalBusiness: false
                  }
                }
              }
            ]
          },
          {
            human: "Vendo como 120 mil al mes",
            expectedAI: CLOSING_MSG,
            // Pre-tool text is non-deterministic: AI may say "Perfecto, guardando..." or "¡Listo!..."
            // depending on whether it predicts finalization before calling saveAnswer.
            // Tools check (saveAnswer + finalizeApplication) is the real behavioral assertion here.
            skipResponseCheck: true,
            tools: [
              {
                name: "saveAnswer",
                mockResponse: {
                  success: true,
                  message: "Campos guardados: monthlySales",
                  data: {
                    saved: ["monthlySales"],
                    invalid: [],
                    simulatedIsc: 83,
                    isOutOfZone: false,
                    isCriticalBusiness: false,
                    missingFields: ["businessAge", "formalization"]
                  }
                }
              },
              {
                name: "finalizeApplication",
                mockResponse: finalizedMock()
              }
            ]
          }
        ]
      },
      {
        id: "out-of-zone",
        description: "Province is not Puerto Plata; José declines gracefully and finalizes",
        turns: [
          {
            human: "Buenas, quiero terminar mi solicitud",
            expectedAI:
              "Gracias por escribirnos. Por el momento solo atendemos negocios en Puerto Plata. Si en el futuro expandimos nuestra cobertura, te avisamos.",
            tools: [
              {
                name: "getApplicationState",
                mockResponse: {
                  success: true,
                  message: "Estado de solicitud obtenido",
                  data: {
                    sessionId: "session-test-001",
                    filledFields: { province: "Santiago", businessType: "Ferretería" },
                    missingFields: ["monthlySales", "businessAge"],
                    simulatedIsc: 30,
                    isOutOfZone: true,
                    isCriticalBusiness: false
                  }
                }
              },
              {
                name: "finalizeApplication",
                mockResponse: finalizedMock()
              }
            ]
          }
        ]
      },
      {
        id: "critical-business",
        description: "Business type is critical; José declines gracefully and finalizes",
        turns: [
          {
            human: "Hola",
            expectedAI:
              "Gracias por tu interés. En este momento no podemos procesar solicitudes para ese tipo de negocio.",
            tools: [
              {
                name: "getApplicationState",
                mockResponse: {
                  success: true,
                  message: "Estado de solicitud obtenido",
                  data: {
                    sessionId: "session-test-001",
                    filledFields: { province: "Puerto Plata", businessType: "Casa de empeño" },
                    missingFields: ["monthlySales"],
                    simulatedIsc: 15,
                    isOutOfZone: false,
                    isCriticalBusiness: true
                  }
                }
              },
              {
                name: "finalizeApplication",
                mockResponse: finalizedMock()
              }
            ]
          }
        ]
      },
      {
        id: "stuck-finalize",
        description:
          "Prospect sends off-topic replies; handler injects SISTEMA warning after 3 turns; José finalizes",
        turns: [
          {
            human: "Hola",
            // Province is the first missing field, so AI will ask "¿En qué provincia está tu negocio?"
            // in off-topic turns (since that's what PRIORIDAD #1 is and it's in missingFields).
            expectedAI:
              "¡Hola! Soy José de Mikro Créditos. Veo que empezaste una solicitud de préstamo. Déjame revisar tu información para ayudarte a completarla.",
            tools: [
              {
                name: "getApplicationState",
                mockResponse: {
                  success: true,
                  message: "Estado de solicitud obtenido",
                  data: {
                    sessionId: "session-test-001",
                    filledFields: {
                      businessType: "Colmado",
                      requestedAmount: 20000,
                      requestedTermWeeks: 10
                    },
                    // province is intentionally missing so PRIORIDAD #1 is the correct question
                    missingFields: ["province", "monthlySales", "businessAge", "formalization"],
                    simulatedIsc: 40,
                    isOutOfZone: false,
                    isCriticalBusiness: false
                  }
                }
              }
            ]
          },
          {
            human: "¿Cuánto tiempo tarda el proceso?",
            expectedAI:
              "El proceso toma entre 24 y 48 horas hábiles. ¿En qué provincia está tu negocio?",
            tools: []
          },
          {
            // SISTEMA injected when turnsSinceLastSave >= 3 (after 3 off-topic turns in production).
            // Critical test: José CALLS finalizeApplication. Response text is non-deterministic
            // (AI may say CLOSING_MSG per SISTEMA rule, or "Entiendo..." empathizing with prospect).
            // Tools check is the real behavioral assertion here.
            human:
              "[SISTEMA: El prospecto lleva 3 turnos sin responder preguntas de intake. Si este mensaje tampoco contiene datos útiles para guardar, llama finalizeApplication ahora.] No sé si voy a solicitar",
            expectedAI: CLOSING_MSG,
            skipResponseCheck: true,
            tools: [
              {
                name: "finalizeApplication",
                mockResponse: finalizedMock()
              }
            ]
          }
        ]
      }
    ]
  }
};
