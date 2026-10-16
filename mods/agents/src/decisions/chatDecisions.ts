/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * A chat model answering decision questions through structured output: the
 * fallback and the baseline the Decisions API is compared against. Same
 * questions, same answer shape; the probabilities are the model's own
 * estimate (chat models tend to answer near 0 or 1).
 */
import { z } from "zod";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { LLMConfig } from "@mikro/common";
import { createChatModel } from "../llm/providers.js";
import type {
  DecisionAnswer,
  DecisionProvider,
  DecisionQuestion,
  DecisionResult
} from "./types.js";

const SYSTEM_PROMPT = `Respondes preguntas tipificadas sobre un texto. No escribes explicaciones.
- Para cada pregunta de sí/no, da la probabilidad (0 a 1) de que la afirmación sea verdadera.
- Para cada pregunta de opción, elige exactamente una de las opciones y da tu confianza (0 a 1).`;

function schemaFor(questions: DecisionQuestion[]) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const q of questions) {
    shape[q.name] =
      q.type === "predicate"
        ? z.number().min(0).max(1).describe(q.instructions)
        : z
            .object({
              choice: z.enum(q.choices.map((c) => c.value) as [string, ...string[]]),
              confidence: z.number().min(0).max(1)
            })
            .describe(q.instructions);
  }
  return z.object(shape);
}

function describe(questions: DecisionQuestion[]): string {
  return questions
    .map((q) =>
      q.type === "predicate"
        ? `- ${q.name} (sí/no): ${q.instructions}`
        : `- ${q.name} (opción): ${q.instructions}\n${q.choices
            .map((c) => `    · ${c.value}: ${c.description}`)
            .join("\n")}`
    )
    .join("\n");
}

const clamp = (n: number) => Math.max(0, Math.min(1, n));

export function createChatDecisionProvider(config: LLMConfig): DecisionProvider {
  const id = `chat:${config.vendor}:${config.model}`;
  return {
    id,
    async ask(input: string, questions: DecisionQuestion[]): Promise<DecisionResult> {
      const started = Date.now();
      const model = createChatModel(config, { temperature: 0 });
      const structured = model.withStructuredOutput(schemaFor(questions), { includeRaw: true });
      const { parsed, raw } = (await structured.invoke([
        new SystemMessage(SYSTEM_PROMPT),
        new HumanMessage(`Preguntas:\n${describe(questions)}\n\nTexto:\n${input}`)
      ])) as {
        parsed: Record<string, number | { choice: string; confidence: number }>;
        raw: { usage_metadata?: { input_tokens?: number; output_tokens?: number } };
      };
      const answers: DecisionAnswer[] = questions.map((q) => {
        const value = parsed?.[q.name];
        if (value === undefined || value === null) return { type: "refusal", name: q.name };
        if (q.type === "predicate") {
          return { type: "predicate", name: q.name, probability: clamp(Number(value)) };
        }
        const picked = value as { choice: string; confidence: number };
        const confidence = clamp(picked.confidence);
        const rest = (1 - confidence) / Math.max(1, q.choices.length - 1);
        return {
          type: "choice",
          name: q.name,
          choice: picked.choice,
          confidence,
          probabilities: q.choices.map((c) => ({
            value: c.value,
            probability: c.value === picked.choice ? confidence : rest
          }))
        };
      });
      return {
        answers,
        model: id,
        inputTokens: raw?.usage_metadata?.input_tokens ?? 0,
        outputTokens: raw?.usage_metadata?.output_tokens ?? 0,
        latencyMs: Date.now() - started
      };
    }
  };
}
