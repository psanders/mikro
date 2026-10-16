/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Audit code checks added with openspec decision-judges: double replies,
 * stuck loops, unanswered messages and replies to closings. Cases from the
 * 2026-10-15 transcript audit.
 */
import { expect } from "chai";
import { CONVERSATION_CHECKS, replySimilarity } from "../../src/audit/checks.js";
import type { AuditConversation, AuditTurn } from "../../src/audit/types.js";

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
        turn("INBOUND", "Gracias", 1, { intent: "closing", intentConfidence: 0.9, settled: 0.95 })
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
    const closing = { intent: "closing", intentConfidence: 0.9, settled: 0.95 };
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

  it("does not count a burst of closings answered once as two replies", () => {
    const closing = { intent: "closing", intentConfidence: 0.9, settled: 0.95 };
    const c = convo([
      turn("AGENT", "Listo, recibimos tu solicitud.", 0),
      turn("INBOUND", "Ok", 1, closing),
      turn("INBOUND", "Gracias", 1.01, closing),
      turn("AGENT", "¡Con gusto!", 2)
    ]);
    expect(check("closing_loop").run(c)).to.have.length(0);
  });

  it("ignores a low-confidence closing label", () => {
    const asOf = new Date(t0 + 120 * 60_000);
    const c = convo(
      [
        turn("AGENT", "¡Listo!", 0),
        turn("INBOUND", "ok y el préstamo?", 1, {
          intent: "closing",
          intentConfidence: 0.4,
          settled: 0.8
        })
      ],
      { asOf }
    );
    expect(check("unanswered").run(c)).to.have.length(1);
  });

  it("treats a tool-only agent turn (nothing sent) as no reply", () => {
    const asOf = new Date(t0 + 120 * 60_000);
    const c = convo(
      [
        turn("AGENT", "¿Cuánto vende al mes?", 0),
        turn("INBOUND", "Unos 30 mil", 1),
        turn("AGENT", "", 1.1, { toolNames: ["saveAnswer"] })
      ],
      { asOf }
    );
    expect(check("unanswered").run(c)).to.have.length(1);
    const followed = convo([...c.turns, turn("AGENT", "Perfecto, ¿y tu cédula?", 1.2)]);
    expect(check("double_reply").run(followed)).to.have.length(0);
  });

  it("does not call short replies that share one word a stuck loop", () => {
    const c = convo([
      turn("AGENT", "Perfecto ^JO", 0),
      turn("INBOUND", "Colmado", 1),
      turn("AGENT", "Perfecto, ¿cuánto vende al mes?", 2),
      turn("INBOUND", "30 mil", 3),
      turn("AGENT", "Perfecto, ¿cuál es tu cédula?", 4)
    ]);
    expect(check("stuck_loop").run(c)).to.have.length(0);
  });
});
