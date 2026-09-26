/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Conversation audit (openspec add-conversation-audit): the code checks, the
 * orchestration (judge cap, judge errors, per-agent breakdown) and the
 * `policies` field on agents.
 */
import { expect } from "chai";
import { runChecks } from "../../src/audit/checks.js";
import { runAudit } from "../../src/audit/runAudit.js";
import { formatTranscript } from "../../src/audit/judge.js";
import type { AuditConversation, AuditTurn, JudgeConversation } from "../../src/audit/types.js";
import { agentConfigSchema } from "../../src/agents/agentSchema.js";
import { agentVersionOf } from "../../src/conversations/transcript.js";
import { PROCESSING_ERROR_REPLY } from "../../src/whatsapp/handleWhatsAppMessage.js";
import { MAX_JOSE_TURNS } from "../../src/whatsapp/handleProspectMessage.js";
import type { Agent } from "../../src/llm/types.js";

const T0 = new Date("2026-09-26T12:00:00Z").getTime();
let nextId = 1;

function turn(partial: Partial<AuditTurn> & Pick<AuditTurn, "role" | "content">): AuditTurn {
  const id = partial.id ?? nextId++;
  return {
    id,
    profile: "APPLICANT",
    agentName: partial.role === "AGENT" ? "sofia" : null,
    agentVersion: partial.role === "AGENT" ? "v1" : null,
    toolNames: [],
    applicationId: "app-1",
    customerId: null,
    failed: false,
    createdAt: new Date(T0 + id * 60_000),
    ...partial
  };
}

function convo(
  turns: AuditTurn[],
  handoffsOpenedAt: Date[] = [],
  phone = "+18095550001"
): AuditConversation {
  return { phone, turns, handoffsOpenedAt };
}

const ids = (c: AuditConversation) => runChecks(c).map((f) => f.checkId);

describe("conversation audit — code checks", () => {
  it("flags a failed send as a warning citing the turn", () => {
    const failed = turn({ role: "AGENT", content: "Tu solicitud está en revisión.", failed: true });
    const findings = runChecks(convo([turn({ role: "INBOUND", content: "hola" }), failed]));
    expect(findings).to.have.length(1);
    expect(findings[0]).to.include({
      checkId: "failed_send",
      severity: "WARNING",
      source: "CODE",
      turnId: failed.id,
      agentName: "sofia",
      applicationId: "app-1"
    });
  });

  it("flags the generic error reply", () => {
    expect(
      ids(convo([turn({ role: "SYSTEM", content: PROCESSING_ERROR_REPLY, agentName: null })]))
    ).to.deep.equal(["error_reply"]);
  });

  it("flags a request for a person with no hand-off", () => {
    const c = convo([turn({ role: "INBOUND", content: "quiero hablar con una persona" })]);
    expect(ids(c)).to.deep.equal(["handoff_ignored"]);
  });

  it("does not flag a request honored by a hand-off within 10 minutes", () => {
    const request = turn({ role: "INBOUND", content: "quiero hablar con una persona" });
    const c = convo([request], [new Date(request.createdAt.getTime() + 5_000)]);
    expect(ids(c)).to.deep.equal([]);
  });

  it("does not treat a passing mention of an advisor as a request", () => {
    expect(
      ids(convo([turn({ role: "INBOUND", content: "mi asesor me dijo que viniera" })]))
    ).to.deep.equal([]);
  });

  it("flags José past the turn cap for one application, citing the first turn over", () => {
    const jose = Array.from({ length: MAX_JOSE_TURNS + 1 }, () =>
      turn({ role: "AGENT", content: "¿Cuánto vendes?", profile: "PROSPECT", agentName: "jose" })
    );
    const findings = runChecks(convo(jose)).filter((f) => f.checkId === "jose_turn_cap");
    expect(findings).to.have.length(1);
    expect(findings[0]!.turnId).to.equal(jose[MAX_JOSE_TURNS]!.id);
  });

  it("does not count failed José turns toward the cap", () => {
    const jose = Array.from({ length: MAX_JOSE_TURNS + 1 }, (_, i) =>
      turn({
        role: "AGENT",
        content: "¿Cuánto vendes?",
        profile: "PROSPECT",
        agentName: "jose",
        failed: i === 0
      })
    );
    expect(runChecks(convo(jose)).filter((f) => f.checkId === "jose_turn_cap")).to.have.length(0);
  });

  it("flags a score stated to the person as critical", () => {
    const findings = runChecks(
      convo([turn({ role: "AGENT", content: "Tu puntaje Mikro es 74, vas bien." })])
    );
    expect(findings.map((f) => [f.checkId, f.severity])).to.deep.equal([
      ["sensitive_score", "CRITICAL"]
    ]);
  });

  it("does not flag the word score without a number", () => {
    expect(
      ids(convo([turn({ role: "AGENT", content: "No puedo compartir tu puntaje." })]))
    ).to.deep.equal([]);
  });

  it("never cites context turns from before the window", () => {
    const old = turn({ role: "AGENT", content: "Tu puntaje es 80", context: true, failed: true });
    expect(ids(convo([old, turn({ role: "INBOUND", content: "gracias" })]))).to.deep.equal([]);
  });
});

describe("conversation audit — runAudit", () => {
  const policies = [
    { id: "no_puntaje", rule: "No revela el puntaje.", severity: "critical" as const },
    { id: "handoff", rule: "Pasa a una persona si la piden.", severity: "warning" as const }
  ];
  const getAgent = (name: string) => (name === "sofia" ? { name, policies } : undefined);

  const sofiaConvo = (phone: string, minutesAgo: number) =>
    convo(
      [
        turn({ role: "INBOUND", content: "hola", createdAt: new Date(T0 - minutesAgo * 60_000) }),
        turn({
          role: "AGENT",
          content: "Hola, tu solicitud está en revisión.",
          createdAt: new Date(T0 - minutesAgo * 60_000 + 1)
        })
      ],
      [],
      phone
    );

  it("stores one JUDGE finding per failed policy with the policy's severity", async () => {
    const c = sofiaConvo("+1809A", 5);
    const agentTurn = c.turns[1]!;
    const judge: JudgeConversation = async () => [
      {
        policyId: "no_puntaje",
        pass: false,
        turnId: agentTurn.id,
        evidence: "Tu puntaje es 74",
        reason: "Dio el puntaje."
      },
      { policyId: "handoff", pass: true, reason: "No aplica." }
    ];
    const r = await runAudit({ conversations: [c], getAgent, maxConversations: 10, judge });
    expect(r.findings).to.have.length(1);
    expect(r.findings[0]).to.include({
      source: "JUDGE",
      checkId: "no_puntaje",
      severity: "CRITICAL",
      turnId: agentTurn.id,
      evidence: "Tu puntaje es 74",
      agentName: "sofia"
    });
    expect(r).to.include({
      criticalCount: 1,
      warningCount: 0,
      judged: 1,
      judgeSkipped: 0,
      judgeErrors: 0
    });
  });

  it("judges the most recently active conversations up to the cap; the rest get code checks only", async () => {
    const judgedPhones: string[] = [];
    const judge: JudgeConversation = async (c) => {
      judgedPhones.push(c.phone);
      return [];
    };
    const conversations = [sofiaConvo("+old", 50), sofiaConvo("+new", 1), sofiaConvo("+mid", 20)];
    const r = await runAudit({ conversations, getAgent, maxConversations: 2, judge });
    expect(judgedPhones.sort()).to.deep.equal(["+mid", "+new"]);
    expect(r).to.include({ conversations: 3, judged: 2, judgeSkipped: 1 });
  });

  it("counts a judge failure and keeps the run going with code findings", async () => {
    const c = convo([
      turn({ role: "INBOUND", content: "hola" }),
      turn({ role: "AGENT", content: "Listo", failed: true })
    ]);
    const judge: JudgeConversation = async () => {
      throw new Error("LLM down");
    };
    const r = await runAudit({ conversations: [c], getAgent, maxConversations: 10, judge });
    expect(r.judgeErrors).to.equal(1);
    expect(r.judged).to.equal(0);
    expect(r.findings.map((f) => f.checkId)).to.deep.equal(["failed_send"]);
  });

  it("skips the judge for agents with no policies", async () => {
    let called = false;
    const judge: JudgeConversation = async () => {
      called = true;
      return [];
    };
    const c = convo([
      turn({ role: "AGENT", content: "Hola", agentName: "lucia", profile: "GUEST" })
    ]);
    const r = await runAudit({ conversations: [c], getAgent, maxConversations: 10, judge });
    expect(called).to.be.false;
    expect(r.judged).to.equal(0);
  });

  it("builds the per-agent breakdown with versions and marks a changed version as new", async () => {
    const c = convo([
      turn({ role: "INBOUND", content: "hola" }),
      turn({ role: "AGENT", content: "Tu puntaje es 74", agentVersion: "v2" })
    ]);
    const r = await runAudit({
      conversations: [c],
      getAgent: () => undefined,
      maxConversations: 10,
      judge: async () => [],
      previousVersions: { sofia: "v1" }
    });
    expect(r.byAgent).to.deep.equal([
      {
        agentName: "sofia",
        profile: "APPLICANT",
        agentVersion: "v2",
        isNewVersion: true,
        conversations: 1,
        critical: 1,
        warning: 0
      }
    ]);
    expect(r.turns).to.equal(2);
  });

  it("ignores conversations with only context turns", async () => {
    const c = convo([turn({ role: "INBOUND", content: "viejo", context: true })]);
    const r = await runAudit({
      conversations: [c],
      getAgent,
      maxConversations: 10,
      judge: async () => []
    });
    expect(r.conversations).to.equal(0);
  });
});

describe("conversation audit — transcript for the judge", () => {
  it("numbers turns and marks context, failed sends and tools", () => {
    const text = formatTranscript(
      convo([
        turn({ id: 7, role: "INBOUND", content: "hola", context: true }),
        turn({
          id: 8,
          role: "AGENT",
          content: "Hola",
          failed: true,
          toolNames: ["getMyApplicationStatus"]
        })
      ])
    );
    expect(text).to.contain("#7");
    expect(text).to.contain("[CONTEXTO]");
    expect(text).to.contain("#8");
    expect(text).to.contain("[NO ENTREGADO]");
    expect(text).to.contain("getMyApplicationStatus");
  });
});

describe("agent policies", () => {
  const base = {
    name: "sofia",
    profile: "APPLICANT",
    systemPrompt: "Eres Sofía.",
    allowedTools: []
  };

  it("loads policies without changing the agent version", () => {
    const withPolicies = agentConfigSchema.parse({
      ...base,
      policies: [
        { id: "no_puntaje", rule: "No revela el puntaje.", severity: "critical" },
        { id: "handoff", rule: "Pasa a una persona.", severity: "warning" }
      ]
    });
    const without = agentConfigSchema.parse(base);
    expect(withPolicies.policies).to.have.length(2);
    expect(agentVersionOf(withPolicies as Agent)).to.equal(agentVersionOf(without as Agent));
  });

  it("rejects an unknown severity", () => {
    const r = agentConfigSchema.safeParse({
      ...base,
      policies: [{ id: "x", rule: "y", severity: "info" }]
    });
    expect(r.success).to.be.false;
  });

  it("rejects duplicate policy ids", () => {
    const r = agentConfigSchema.safeParse({
      ...base,
      policies: [
        { id: "x", rule: "a", severity: "warning" },
        { id: "x", rule: "b", severity: "critical" }
      ]
    });
    expect(r.success).to.be.false;
  });
});
