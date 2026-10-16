/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Backfill labeling of stored CX turns (openspec conversation-state D8).
 */
import { expect } from "chai";
import type { DecisionProvider } from "@mikro/agents";
import { createClassifyConversationTurns } from "../../src/api/conversations/classifyTurns.js";

const at = (min: number) => new Date(Date.UTC(2026, 9, 8, 22, min));

function turn(id: number, role: string, content: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    phone: "+18293913988",
    role,
    content,
    hasImage: false,
    failed: false,
    intent: null as string | null,
    createdAt: at(id),
    ...extra
  };
}

function fakeDb(rows: ReturnType<typeof turn>[], earlier: ReturnType<typeof turn>[] = []) {
  const updates: Array<{ id: number; data: Record<string, unknown> }> = [];
  return {
    updates,
    db: {
      conversationTurn: {
        // The backfill query (by `since`) gets `rows`; the context query (`id < first`) gets `earlier`, newest first.
        findMany: async ({ where }: { where: { id?: { lt: number } } }) =>
          where.id ? [...earlier].reverse() : rows,
        update: async ({
          where,
          data
        }: {
          where: { id: number };
          data: Record<string, unknown>;
        }) => {
          updates.push({ id: where.id, data });
          return {};
        }
      }
    } as never
  };
}

function stubProvider(intent: string): DecisionProvider & { inputs: string[] } {
  const inputs: string[] = [];
  return {
    id: "openai-decisions:gpt-6-luna",
    inputs,
    async ask(input) {
      inputs.push(input);
      return {
        answers: [
          { type: "choice", name: "intent", choice: intent, confidence: 0.95, probabilities: [] },
          { type: "predicate", name: "settled", probability: 0.9 },
          { type: "predicate", name: "affirms", probability: 0.2 },
          { type: "predicate", name: "same_request", probability: 0.05 }
        ],
        model: "openai-decisions:gpt-6-luna",
        inputTokens: 400,
        outputTokens: 0,
        latencyMs: 120
      };
    }
  };
}

describe("classifyConversationTurns", () => {
  const rows = () => [
    turn(1, "INBOUND", "Hola"),
    turn(2, "AGENT", "¡Hola! ¿En qué podemos ayudarte hoy?\n\n^LU"),
    turn(3, "INBOUND", "Gracias"),
    turn(4, "INBOUND", "[Imagen]", { hasImage: true }),
    turn(5, "INBOUND", "Ok", { intent: "closing" })
  ];

  it("labels unlabeled inbound turns with the turns before them as context", async () => {
    const { db, updates } = fakeDb(rows());
    const provider = stubProvider("closing");
    const result = await createClassifyConversationTurns(db, provider)({ since: at(0) });

    expect(result).to.deep.include({ classified: 3, skipped: 1, errors: 0, dryRun: false });
    // Only the two text messages reach the model; the photo is labeled by code.
    expect(provider.inputs).to.have.length(2);
    expect(provider.inputs[1]).to.contain("AGENTE: ¡Hola! ¿En qué podemos ayudarte hoy?");
    expect(provider.inputs[1]).to.contain("MENSAJE NUEVO DE LA PERSONA: Gracias");
    expect(updates.map((u) => u.id)).to.deep.equal([1, 3, 4]);
    expect(updates[2]!.data).to.deep.include({ intent: "media", intentConfidence: 1 });
    expect(JSON.parse(String(updates[1]!.data.classification))).to.deep.equal({
      model: "openai-decisions:gpt-6-luna",
      settled: 0.9,
      affirms: 0.2,
      sameRequest: 0.05
    });
    expect(result.costUsd).to.be.closeTo((2 * 400 * 0.1) / 1_000_000, 1e-12);
  });

  it("reads the turns from before `since` as context for the first message", async () => {
    const earlier = [turn(0, "AGENT", "Listo, tu solicitud fue recibida.\n\n^SO")];
    const { db } = fakeDb([turn(1, "INBOUND", "Gracias")], earlier);
    const provider = stubProvider("closing");
    await createClassifyConversationTurns(db, provider)({ since: at(1) });
    expect(provider.inputs[0]).to.contain("AGENTE: Listo, tu solicitud fue recibida.");
  });

  it("writes nothing on a dry run", async () => {
    const { db, updates } = fakeDb(rows());
    const result = await createClassifyConversationTurns(
      db,
      stubProvider("greeting")
    )({
      since: at(0),
      dryRun: true
    });
    expect(result.classified).to.equal(3);
    expect(updates).to.have.length(0);
  });

  it("re-labels with --force", async () => {
    const { db } = fakeDb(rows());
    const result = await createClassifyConversationTurns(
      db,
      stubProvider("closing")
    )({
      since: at(0),
      force: true,
      dryRun: true
    });
    expect(result).to.deep.include({ classified: 4, skipped: 0 });
  });

  it("counts a failed call and keeps going", async () => {
    const { db } = fakeDb(rows());
    let calls = 0;
    const flaky: DecisionProvider = {
      id: "x",
      async ask(input, questions) {
        calls += 1;
        if (calls === 1) throw new Error("Decisions API 500: boom");
        return stubProvider("closing").ask(input, questions);
      }
    };
    const result = await createClassifyConversationTurns(db, flaky)({ since: at(0), dryRun: true });
    expect(result).to.deep.include({ classified: 2, errors: 1 });
  });
});
