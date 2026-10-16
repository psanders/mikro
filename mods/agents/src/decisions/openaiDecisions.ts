/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * OpenAI Decisions API adapter (public beta, 2026-10): `POST /v1/decisions`
 * with `{ model, input, questions }`; answers carry `probability` (predicate)
 * or `choice` + `probabilities` + `confidence` (choice). Priced on input
 * tokens only. See https://developers.openai.com/api/docs/guides/decisions.
 */
import type {
  DecisionAnswer,
  DecisionProvider,
  DecisionQuestion,
  DecisionResult
} from "./types.js";

const ENDPOINT = "https://api.openai.com/v1/decisions";

export interface OpenAIDecisionsOptions {
  apiKey: string;
  model?: string;
  /** Abort the call after this long. Callers fall back when it fails. */
  timeoutMs?: number;
  /** Injectable for tests. */
  fetchImpl?: typeof fetch;
}

interface RawResponse {
  model?: string;
  answers?: DecisionAnswer[];
  usage?: { input_tokens?: number; output_tokens?: number };
  error?: { message?: string; type?: string };
}

export function createOpenAIDecisionsProvider(options: OpenAIDecisionsOptions): DecisionProvider {
  const model = options.model ?? "gpt-6-luna";
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 10_000;

  return {
    id: `openai-decisions:${model}`,
    async ask(input: string, questions: DecisionQuestion[]): Promise<DecisionResult> {
      const started = Date.now();
      const response = await fetchImpl(ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${options.apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ model, input, questions }),
        signal: AbortSignal.timeout(timeoutMs)
      });
      const body = (await response.json().catch(() => ({}))) as RawResponse;
      if (!response.ok) {
        throw new Error(
          `Decisions API ${response.status}: ${body.error?.message ?? response.statusText}`
        );
      }
      const answers = body.answers ?? [];
      const missing = questions.filter((q) => !answers.some((a) => a.name === q.name));
      if (missing.length > 0) {
        throw new Error(
          `Decisions API returned no answer for: ${missing.map((q) => q.name).join(", ")}`
        );
      }
      return {
        answers,
        model: `openai-decisions:${body.model ?? model}`,
        inputTokens: body.usage?.input_tokens ?? 0,
        outputTokens: body.usage?.output_tokens ?? 0,
        latencyMs: Date.now() - started
      };
    }
  };
}
