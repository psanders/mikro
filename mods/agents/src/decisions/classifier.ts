/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Labels an inbound CX message (openspec conversation-state D1): one decision
 * request with the intent as a choice and three predicates, over the last few
 * turns. Labels only: nothing here changes how the agents reply.
 */
import { DECISION_MIN_CONFIDENCE, answerOf } from "./verdict.js";
import type { DecisionProvider, DecisionQuestion } from "./types.js";

export const INTENTS = [
  "answer",
  "question",
  "closing",
  "opt_out",
  "repeat",
  "frustration",
  "human_request",
  "greeting",
  "other"
] as const;

/** `media` is set by code (no model call) for photos, videos, audio and stickers without text. */
export type Intent = (typeof INTENTS)[number] | "media";

const INTENT_DESCRIPTIONS: Record<(typeof INTENTS)[number], string> = {
  answer:
    "Responde lo que el agente le preguntó o da un dato que se le pidió (incluye un 'sí' u 'ok' que contesta una pregunta).",
  question: "Hace una pregunta o pide información nueva.",
  closing:
    "Solo agradece, se despide o confirma recibido ('ok', 'gracias', 'igual', '👍') sin pedir ni aportar nada.",
  opt_out: "Dice que ya no quiere el préstamo o pide cancelar/descartar su solicitud.",
  repeat:
    "Vuelve a enviar lo mismo que ya envió y que el agente no pudo usar (un enlace, un video, el mismo texto).",
  frustration: "Se queja, reclama que no le responden o muestra enojo o impaciencia.",
  human_request: "Pide hablar con una persona o un asesor.",
  greeting: "Solo saluda ('hola', 'buenas', 'saludos') sin más.",
  other: "Ninguna de las anteriores."
};

/** How many earlier turns the classifier sees. */
export const CLASSIFIER_CONTEXT_TURNS = 6;

/**
 * Inbound content the handler stores for a message without text: `[imagen]`,
 * `[video]`, `[nota de voz]`, `[location]`, `[reaction]`, …
 */
export const MEDIA_PLACEHOLDER_RE = /^\[(nota de voz|[a-z_]+)\]$/i;

export interface ClassifierTurn {
  role: "INBOUND" | "AGENT" | "SYSTEM";
  content: string;
}

export interface ClassifyInput {
  /** Earlier turns, oldest first (sign-offs already stripped or not; both fine). */
  history: ClassifierTurn[];
  /** The new inbound message's text (empty for media without caption). */
  message: string;
  /** Photo, video, audio or other non-text message. */
  isMedia?: boolean;
}

export interface Classification {
  intent: Intent;
  /** The model's confidence in `intent` (1 for code-set media). */
  confidence: number;
  /** Probabilities of the three predicates; absent for code-set media. */
  predicates?: { settled: number; affirms: number; sameRequest: number };
  /** `provider:model`, or `code` for media. */
  model: string;
  inputTokens: number;
  latencyMs: number;
}

export const CLASSIFIER_QUESTIONS: DecisionQuestion[] = [
  {
    type: "choice",
    name: "intent",
    instructions:
      "¿Qué hace el MENSAJE NUEVO de la persona en esta conversación de WhatsApp con Mikro (préstamos para pequeños negocios en República Dominicana)?",
    choices: INTENTS.map((value) => ({ value, description: INTENT_DESCRIPTIONS[value] }))
  },
  {
    type: "predicate",
    name: "settled",
    instructions:
      "El último mensaje del AGENTE ya resolvió lo que la persona necesitaba o cerró el tema (se despidió, confirmó, informó o dijo que una persona le responderá). Una pregunta de cortesía como '¿Hay algo más en lo que pueda ayudarte?' o '¿En qué puedo ayudarte?' NO cuenta como pregunta pendiente."
  },
  {
    type: "predicate",
    name: "affirms",
    instructions: "El MENSAJE NUEVO confirma o acepta lo que el AGENTE le preguntó o propuso."
  },
  {
    type: "predicate",
    name: "same_request",
    instructions:
      "El MENSAJE NUEVO repite el mismo contenido que la persona ya envió antes y que el AGENTE ya dijo que no puede usar."
  }
];

const SPEAKER = { INBOUND: "PERSONA", AGENT: "AGENTE", SYSTEM: "SISTEMA" } as const;
const SIGNATURE_RE = /\s*\^[A-Z]{2}\s*$/;

/** The text the decision model reads: recent turns, then the new message. */
export function classifierInput(input: ClassifyInput): string {
  const recent = input.history.slice(-CLASSIFIER_CONTEXT_TURNS);
  const lines = recent.map(
    (t) => `${SPEAKER[t.role]}: ${t.content.replace(SIGNATURE_RE, "").trim() || "(sin texto)"}`
  );
  return [
    lines.length
      ? `CONVERSACIÓN RECIENTE:\n${lines.join("\n")}`
      : "CONVERSACIÓN RECIENTE: (ninguna)",
    `MENSAJE NUEVO DE LA PERSONA: ${input.message.trim() || "(sin texto)"}`
  ].join("\n\n");
}

/** A message that is only media: no model call. */
export function isMediaOnly(input: ClassifyInput): boolean {
  if (!input.isMedia) return false;
  const text = input.message.trim();
  return !text || MEDIA_PLACEHOLDER_RE.test(text);
}

export async function classifyInbound(
  provider: DecisionProvider,
  input: ClassifyInput
): Promise<Classification> {
  if (isMediaOnly(input)) {
    return { intent: "media", confidence: 1, model: "code", inputTokens: 0, latencyMs: 0 };
  }
  const result = await provider.ask(classifierInput(input), CLASSIFIER_QUESTIONS);
  const intent = answerOf(result, "intent");
  const prob = (name: string) => {
    const a = answerOf(result, name);
    return a?.type === "predicate" ? a.probability : 0;
  };
  return {
    intent: intent?.type === "choice" ? (intent.choice as Intent) : "other",
    confidence: intent?.type === "choice" ? intent.confidence : 0,
    predicates: {
      settled: prob("settled"),
      affirms: prob("affirms"),
      sameRequest: prob("same_request")
    },
    model: result.model,
    inputTokens: result.inputTokens,
    latencyMs: result.latencyMs
  };
}

/** The label to act on: below the confidence floor it is `other`, which never acts. */
export function effectiveIntent(
  c: Pick<Classification, "intent" | "confidence">,
  threshold = DECISION_MIN_CONFIDENCE
): Intent {
  return c.confidence >= threshold ? c.intent : "other";
}
