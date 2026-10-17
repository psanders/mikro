/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * The LLM side of decision-model judging: answers one yes/no question about a
 * text with a short reason. Used when the decision model is unsure and to explain
 * eval failures (openspec decision-judges).
 */
import { z } from "zod";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { getEvalsModel } from "../config.js";
import { createChatModel } from "../llm/providers.js";

const llmAnswerSchema = z.object({
  answer: z.boolean().describe("La respuesta a la pregunta (true = sí)"),
  reason: z.string().describe("Una oración corta en español que lo justifica")
});

/** The LLM judge: answers one check with a reason (evals LLM, low temperature). */
export type CheckLlmJudge = (
  input: string,
  question: string
) => Promise<{ answer: boolean; reason: string }>;

export function createCheckLlmJudge(): CheckLlmJudge {
  return async (input, question) => {
    const model = createChatModel(getEvalsModel(), { temperature: 0.1 });
    const structured = model.withStructuredOutput(llmAnswerSchema);
    return structured.invoke([
      new SystemMessage(
        "Eres el juez de evaluaciones de un agente de WhatsApp de Mikro (préstamos para pequeños negocios en República Dominicana). Lee la conversación y responde la pregunta sobre la RESPUESTA DEL AGENTE con sí o no, y una razón breve."
      ),
      new HumanMessage(`${input}\n\nPREGUNTA: ${question}`)
    ]);
  };
}
