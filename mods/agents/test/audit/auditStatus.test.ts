/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * The audit's verdict in words: the card headline and the template status
 * (clean runs, and the fallback when the AI writer fails).
 */
import { expect } from "chai";
import {
  auditHeadline,
  auditCountingPhrase,
  auditStatusFallback,
  type AuditStatusFinding
} from "../../src/audit/status.js";

const leak: AuditStatusFinding = {
  severity: "CRITICAL",
  agentName: "sofia",
  rule: "No revela el puntaje.",
  reason: "Dio el puntaje."
};
const failed: AuditStatusFinding = {
  severity: "WARNING",
  agentName: "carmen",
  rule: "Mensaje no entregado",
  reason: "El envío falló."
};

describe("audit headline", () => {
  it("says how many conversations don't comply", () => {
    expect(auditHeadline(42, 3)).to.equal("3 de 42 conversaciones no cumplen");
    expect(auditHeadline(42, 1)).to.equal("1 de 42 conversaciones no cumple");
  });

  it("says when all comply", () => {
    expect(auditHeadline(37, 0)).to.equal("las 37 conversaciones cumplen");
    expect(auditHeadline(1, 0)).to.equal("la conversación cumple");
  });

  it("words single and all-flagged runs naturally", () => {
    expect(auditHeadline(1, 1)).to.equal("la conversación no cumple");
    expect(auditHeadline(2, 2)).to.equal("las 2 conversaciones no cumplen");
    expect(auditHeadline(0, 0)).to.equal("sin conversaciones nuevas");
  });

  it("counting phrase matches the headline's grammar", () => {
    expect(auditCountingPhrase(42, 3)).to.equal("3 de las 42 conversaciones revisadas no cumplen.");
    expect(auditCountingPhrase(1, 1)).to.equal("La conversación revisada no cumple.");
  });
});

describe("audit status template", () => {
  it("states a clean run, with hand-offs when there were any", () => {
    expect(
      auditStatusFallback({ conversations: 37, flaggedConversations: 0, handoffs: 3, findings: [] })
    ).to.equal("Las 37 conversaciones revisadas cumplen las reglas. 3 pasaron a una persona.");
    expect(
      auditStatusFallback({ conversations: 1, flaggedConversations: 0, handoffs: 0, findings: [] })
    ).to.equal("La conversación revisada cumple las reglas.");
  });

  it("names the worst problem and counts the rest", () => {
    expect(
      auditStatusFallback({
        conversations: 42,
        flaggedConversations: 2,
        handoffs: 4,
        findings: [leak, failed]
      })
    ).to.equal(
      "2 de las 42 conversaciones revisadas no cumplen. Lo más grave (Sofía): No revela el puntaje. Hay 1 problema más en el detalle."
    );
  });

  it("says when there were no new conversations", () => {
    expect(
      auditStatusFallback({ conversations: 0, flaggedConversations: 0, handoffs: 0, findings: [] })
    ).to.equal("No hubo conversaciones nuevas desde la auditoría anterior.");
  });
});
