/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Layered audit (openspec decision-judges): the new code checks and the
 * decision-model screen in front of the LLM judge. Cases from the 2026-10-15
 * transcript audit.
 */
import { expect } from "chai";
import sinon from "sinon";
import { CONVERSATION_CHECKS, replySimilarity } from "../../src/audit/checks.js";
import {
  createDecisionScreenJudge,
  newScreenStats,
  policyQuestion
} from "../../src/audit/screen.js";
import type { AuditConversation, AuditTurn } from "../../src/audit/types.js";
import type { DecisionProvider } from "../../src/decisions/index.js";

const t0 = Date.UTC(2026, 8, 30, 3, 30);
let id = 0;
function turn(
  role: AuditTurn["role"],
  content: string,
  minute: number,
  extra: Partial<AuditTurn> = {}
): AuditTurn {
  return {
    id: ++id,
    role,
    content,
    profile: "APPLICANT",
    agentName: role === "AGENT" ? "sofia" : null,
    agentVersion: role === "AGENT" ? "v1" : null,
    toolNames: [],
    applicationId: "app-1",
    customerId: null,
    failed: false,
    createdAt: new Date(t0 + minute * 60_000),
    ...extra
  };
}
const convo = (turns: AuditTurn[], extra: Partial<AuditConversation> = {}): AuditConversation => ({
  phone: "+18094283758",
  turns,
  handoffsOpenedAt: [],
  ...extra
});
const check = (checkId: string) => CONVERSATION_CHECKS.find((c) => c.id === checkId)!;

describe("audit code checks (decision-judges)", () => {
  it("flags two agent replies to one message (the 09-30 burst)", () => {
    const c = convo([
      turn("INBOUND", "[video]", 0),
      turn("INBOUND", "[video]", 0.01),
      turn("AGENT", "Hola, sigo aquí para ayudarte.", 0.05),
      turn("AGENT", "Necesito que me envíes una foto (no video).", 0.06)
    ]);
    expect(check("double_reply").run(c)).to.have.length(1);
  });

  it("flags the third near-identical request in a row (videos instead of photos)", () => {
    const ask =
      "Hola, sigo esperando la foto de tu negocio de ganado para completar tu solicitud. ¿Podrías enviarla?";
    const c = convo([
      turn("INBOUND", "[video]", 0),
      turn("AGENT", ask, 1),
      turn("INBOUND", "[video]", 2),
      turn(
        "AGENT",
        "Hola, necesito que me envíes una foto de tu negocio de ganado para completar tu solicitud.",
        3
      ),
      turn("INBOUND", "[video]", 4),
      turn("AGENT", ask, 5)
    ]);
    const hits = check("stuck_loop").run(c);
    expect(hits).to.have.length(1);
    expect(replySimilarity(ask, "¡Gracias! Ya recibimos todos los documentos.")).to.be.lessThan(
      0.45
    );
  });

  it("flags a message left without reply, but not a closing or one a person has", () => {
    const asOf = new Date(t0 + 120 * 60_000);
    const question = convo(
      [turn("AGENT", "¿En qué te ayudo?", 0), turn("INBOUND", "yo kiero información", 1)],
      { asOf }
    );
    expect(check("unanswered").run(question)).to.have.length(1);

    const closing = convo(
      [
        turn("AGENT", "¡Listo!", 0),
        turn("INBOUND", "Gracias", 1, { intent: "closing", settled: 0.95 })
      ],
      { asOf }
    );
    expect(check("unanswered").run(closing)).to.have.length(0);

    const handedOff = convo([turn("INBOUND", "Hola", 1)], {
      asOf,
      handoffsOpenedAt: [new Date(t0 + 30_000)]
    });
    expect(check("unanswered").run(handedOff)).to.have.length(0);
  });

  it("flags replying to a second closing in a row (Lucía 10-08)", () => {
    const closing = { intent: "closing", settled: 0.95 };
    const c = convo([
      turn("AGENT", "Si estás listo, puedes llenar tu solicitud.", 0),
      turn("INBOUND", "Ok", 1, closing),
      turn("AGENT", "Excelente. Si tienes alguna pregunta, aquí estamos.", 2),
      turn("INBOUND", "Ya", 3, closing),
      turn("AGENT", "Perfecto. Cualquier cosa, escríbenos.", 4),
      turn("INBOUND", "Esta bien", 5, closing),
      turn("AGENT", "Genial. Aquí estamos.", 6)
    ]);
    expect(check("closing_loop").run(c)).to.have.length(1);
  });
});

describe("decision screen judge", () => {
  const policies = [
    { id: "no_fechas", rule: "No da fechas ni plazos.", severity: "critical" as const },
    { id: "no_puntaje", rule: "No revela el puntaje.", severity: "critical" as const },
    {
      id: "no_inventar",
      rule: "No inventa información.",
      severity: "warning" as const,
      screen: false
    }
  ];
  const conversation = convo([
    turn("INBOUND", "¿cuándo me dan el dinero?", 0),
    turn("AGENT", "Tu solicitud está en revisión.", 1),
    turn("INBOUND", "ok", 2),
    turn("AGENT", "Te desembolsamos el viernes.", 3)
  ]);

  function provider(
    byTurn: Array<Record<string, number>>
  ): DecisionProvider & { inputs: string[]; names: string[][] } {
    const inputs: string[] = [];
    const names: string[][] = [];
    return {
      id: "stub",
      inputs,
      names,
      async ask(input, questions) {
        const probs = byTurn[inputs.length] ?? {};
        inputs.push(input);
        names.push(questions.map((q) => q.name));
        return {
          answers: questions.map((q) => ({
            type: "predicate" as const,
            name: q.name,
            probability: probs[q.name] ?? 0.01
          })),
          model: "openai-decisions:gpt-6-luna",
          inputTokens: 600,
          outputTokens: 0,
          latencyMs: 140
        };
      }
    };
  }

  it("screens each agent turn once, skips unscreened rules, and calls no LLM when clean", async () => {
    const decisions = provider([{}, {}]);
    const confirmTurn = sinon.stub();
    const conversationJudge = sinon.stub().resolves([]);
    const stats = newScreenStats();
    const verdicts = await createDecisionScreenJudge({
      decisions,
      confirmTurn,
      conversationJudge,
      stats
    })(conversation, { name: "sofia", policies });
    expect(verdicts).to.deep.equal([]);
    expect(decisions.inputs).to.have.length(2);
    expect(decisions.names[0]).to.deep.equal(["no_fechas", "no_puntaje"]);
    expect(decisions.inputs[1]).to.contain(
      "MENSAJE DEL AGENTE A REVISAR: Te desembolsamos el viernes."
    );
    expect(confirmTurn.called).to.equal(false);
    expect(conversationJudge.called).to.equal(false);
    expect(stats).to.deep.include({
      turnsScreened: 2,
      decisionCalls: 2,
      flags: 0,
      confirmCalls: 0
    });
  });

  it("asks what the rule forbids, not whether it is broken (no double negative)", () => {
    expect(policyQuestion({ rule: "No da fechas." })).to.contain("hace lo que esta regla prohíbe");
  });

  it("confirms a flagged turn with one focused question and cites the turn", async () => {
    const decisions = provider([{}, { no_fechas: 0.93 }]);
    const confirmTurn = sinon
      .stub()
      .resolves({ answer: true, reason: "Da una fecha de desembolso." });
    const conversationJudge = sinon.stub().resolves([]);
    const flags: unknown[] = [];
    const verdicts = await createDecisionScreenJudge({
      decisions,
      confirmTurn,
      conversationJudge,
      onFlag: (f) => flags.push(f)
    })(conversation, { name: "sofia", policies });
    expect(verdicts).to.deep.equal([
      {
        policyId: "no_fechas",
        pass: false,
        turnId: conversation.turns[3]!.id,
        evidence: "Te desembolsamos el viernes.",
        reason: "Da una fecha de desembolso."
      }
    ]);
    expect(confirmTurn.firstCall.args[1]).to.contain("No da fechas ni plazos.");
    expect(flags).to.have.length(1);
    // Escalated: the unscreened rule is graded over the whole conversation.
    expect(
      conversationJudge.firstCall.args[1].policies.map((p: { id: string }) => p.id)
    ).to.deep.equal(["no_inventar"]);
  });

  it("drops a flag the focused LLM rejects", async () => {
    const decisions = provider([{ no_puntaje: 0.8 }, {}]);
    const confirmTurn = sinon.stub().resolves({ answer: false, reason: "No menciona un puntaje." });
    const verdicts = await createDecisionScreenJudge({ decisions, confirmTurn })(conversation, {
      name: "sofia",
      policies
    });
    expect(verdicts).to.deep.equal([]);
  });

  it("grades a turn only against the rules of the agent that wrote it", async () => {
    const decisions = provider([]);
    const other = convo([turn("AGENT", "Envíame tu cédula.", 0, { agentName: "sofia" })]);
    await createDecisionScreenJudge({ decisions, confirmTurn: sinon.stub() })(other, {
      name: "lucia",
      policies
    });
    expect(decisions.inputs).to.have.length(0);
  });
});
