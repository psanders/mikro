/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * The intake conversation is capped at 7 José turns. On the final allowed turn,
 * handleProspectMessage injects a directive forcing José to finalize instead of
 * asking more questions — this guarantees a short form regardless of ISC.
 */
import { expect } from "chai";
import sinon from "sinon";
import { writeFileSync, unlinkSync, existsSync } from "fs";
import { resolve } from "path";
import { clearConfigCache, getConfig } from "@mikro/common";
import { handleProspectMessage } from "../../src/whatsapp/handleProspectMessage.js";
import { clearSessionsForTesting } from "../../src/sessions/sessionStore.js";
import type { Message } from "../../src/llm/types.js";

type Deps = Parameters<typeof handleProspectMessage>[3];

/**
 * One prospect turn, keeping `deps.history` the way the persisted transcript
 * would: the original message, then José's reply with the tools it ran.
 */
async function turn(deps: Deps, message: string) {
  const result = await handleProspectMessage(PHONE, SESSION, message, {
    ...deps,
    history: [...deps.history]
  });
  deps.history.push({ role: "user", content: message });
  deps.history.push({
    role: "assistant",
    content: result.text,
    ...(result.toolsExecuted.length > 0 ? { tools_executed: result.toolsExecuted } : {})
  });
  return result;
}

const PHONE = "+18095550000";
const SESSION = "sess-jose-cap";
const TEST_CONFIG_PATH = resolve(process.cwd(), "mikro-test-prospect.json");

const TEST_CONFIG = {
  sessionTimeoutSeconds: 3600,
  llm: {
    text: { vendor: "openai", apiKey: "test-key", model: "gpt-4o-mini" },
    vision: { vendor: "openai", apiKey: "test-key", model: "gpt-4o" },
    evals: { vendor: "openai", apiKey: "test-key", model: "gpt-4o-mini" }
  },
  whatsapp: { phoneNumberId: "test", accessToken: "test" },
  accounting: { disbursementAccountId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1" },
  applications: { coveredProvinces: ["PUERTO_PLATA"] }
};

describe("handleProspectMessage submit-by turn", () => {
  before(() => {
    writeFileSync(TEST_CONFIG_PATH, JSON.stringify(TEST_CONFIG));
    clearConfigCache();
    getConfig(TEST_CONFIG_PATH);
  });
  after(() => {
    if (existsSync(TEST_CONFIG_PATH)) unlinkSync(TEST_CONFIG_PATH);
    clearConfigCache();
  });
  beforeEach(() => {
    clearSessionsForTesting();
  });
  afterEach(() => sinon.restore());

  function makeDeps() {
    // Report a saveAnswer each turn so the stuck-counter never fires; we are
    // isolating the hard turn cap.
    const invokeLLM = sinon
      .stub()
      .resolves({ text: "Anotado. ¿siguiente?", toolsExecuted: [{ name: "saveAnswer" }] });
    return { invokeLLM, joseAgent: { name: "jose" } as any, history: [] as Message[] };
  }

  it("does not force the submission during the first 6 turns", async () => {
    const deps = makeDeps();
    for (let i = 0; i < 6; i++) {
      await turn(deps, `respuesta ${i}`);
    }
    for (const call of deps.invokeLLM.getCalls()) {
      expect(call.args[2]).to.not.contain("Es momento de enviar la solicitud");
    }
  });

  it("tells José to submit (and keep asking) on the 7th turn", async () => {
    const deps = makeDeps();
    for (let i = 0; i < 7; i++) {
      await turn(deps, `respuesta ${i}`);
    }
    const seventh = deps.invokeLLM.getCall(6);
    expect(seventh.args[2]).to.contain("Es momento de enviar la solicitud");
    expect(seventh.args[2]).to.contain("seguir con unas preguntas más");
    // The prospect's original text is preserved after the directive.
    expect(seventh.args[2]).to.contain("respuesta 6");
  });
});

// Issue #299: the counters come from the persisted history, so an intake
// picks up where it was after an apiserver restart.
describe("handleProspectMessage counters from history", () => {
  before(() => {
    writeFileSync(TEST_CONFIG_PATH, JSON.stringify(TEST_CONFIG));
    clearConfigCache();
    getConfig(TEST_CONFIG_PATH);
  });
  after(() => {
    if (existsSync(TEST_CONFIG_PATH)) unlinkSync(TEST_CONFIG_PATH);
    clearConfigCache();
  });
  beforeEach(() => clearSessionsForTesting());
  afterEach(() => sinon.restore());

  const exchange = (saved: boolean): Message[] => [
    { role: "user", content: "algo" },
    {
      role: "assistant",
      content: "¿siguiente?",
      ...(saved ? { tools_executed: [{ name: "saveAnswer", args: {} }] } : {})
    }
  ];

  it("forces the submit directive when the stored history already has 6 José replies", async () => {
    const invokeLLM = sinon.stub().resolves({ text: "Listo", toolsExecuted: [] });
    const history = Array.from({ length: 6 }, () => exchange(true)).flat();

    await handleProspectMessage(PHONE, SESSION, "última", {
      invokeLLM,
      joseAgent: { name: "jose" } as any,
      history
    });

    expect(invokeLLM.firstCall.args[2]).to.contain("Es momento de enviar la solicitud");
    expect(invokeLLM.firstCall.args[1]).to.equal(history);
  });

  it("counts José replies since the last save for the stuck warning", async () => {
    const invokeLLM = sinon.stub().resolves({ text: "ok", toolsExecuted: [] });
    const history = [...exchange(true), ...exchange(false), ...exchange(false), ...exchange(false)];

    await handleProspectMessage(PHONE, SESSION, "jaja", {
      invokeLLM,
      joseAgent: { name: "jose" } as any,
      history
    });

    expect(invokeLLM.firstCall.args[2]).to.contain("lleva 3 turnos sin responder");
  });

  it("ignores inbound messages José never answered when counting", async () => {
    const invokeLLM = sinon.stub().resolves({ text: "ok", toolsExecuted: [] });
    // Messages sent during a hand-off are in the transcript but got no reply.
    const history: Message[] = [
      ...exchange(true),
      { role: "user", content: "hola?" },
      { role: "user", content: "hola??" },
      { role: "user", content: "??" }
    ];

    await handleProspectMessage(PHONE, SESSION, "sigo", {
      invokeLLM,
      joseAgent: { name: "jose" } as any,
      history
    });

    expect(invokeLLM.firstCall.args[2]).to.equal("sigo");
  });
});

describe("handleProspectMessage opt-out detection", () => {
  before(() => {
    writeFileSync(TEST_CONFIG_PATH, JSON.stringify(TEST_CONFIG));
    clearConfigCache();
    getConfig(TEST_CONFIG_PATH);
  });
  after(() => {
    if (existsSync(TEST_CONFIG_PATH)) unlinkSync(TEST_CONFIG_PATH);
    clearConfigCache();
  });
  beforeEach(() => {
    clearSessionsForTesting();
  });
  afterEach(() => sinon.restore());

  function makeDeps() {
    const invokeLLM = sinon
      .stub()
      .resolves({ text: "Entendido, que estés bien.", toolsExecuted: [] });
    return { invokeLLM, joseAgent: { name: "jose" } as any, history: [] as Message[] };
  }

  [
    "La verdad ya no me interesa",
    "No quiero el préstamo",
    "déjenme tranquilo",
    "No, gracias"
  ].forEach((msg) => {
    it(`injects the abandon directive for: "${msg}"`, async () => {
      const deps = makeDeps();
      await turn(deps, msg);
      const arg = deps.invokeLLM.getCall(0).args[2] as string;
      expect(arg).to.contain("NO está interesado");
      expect(arg).to.contain(msg);
    });
  });

  it("does NOT treat a plain 'no' answer as a decline (no false positive)", async () => {
    const deps = makeDeps();
    await turn(deps, "No");
    const arg = deps.invokeLLM.getCall(0).args[2] as string;
    expect(arg).to.not.contain("NO está interesado");
    expect(arg).to.equal("No");
  });
});

// openspec jose-keep-gathering: after submission José keeps asking, with no cap,
// and a decline or a stuck conversation only ends his questions.
describe("handleProspectMessage after submission (enrichment)", () => {
  before(() => {
    writeFileSync(TEST_CONFIG_PATH, JSON.stringify(TEST_CONFIG));
    clearConfigCache();
    getConfig(TEST_CONFIG_PATH);
  });
  after(() => {
    if (existsSync(TEST_CONFIG_PATH)) unlinkSync(TEST_CONFIG_PATH);
    clearConfigCache();
  });
  afterEach(() => sinon.restore());

  const exchange = (saved: boolean): Message[] => [
    { role: "user", content: "algo" },
    {
      role: "assistant",
      content: "ok",
      tools_executed: saved ? [{ name: "saveAnswer", args: {} }] : []
    }
  ];

  async function run(message: string, history: Message[], extra: Record<string, unknown> = {}) {
    const invokeLLM = sinon.stub().resolves({ text: "ok", toolsExecuted: [] });
    await handleProspectMessage(PHONE, SESSION, message, {
      invokeLLM,
      joseAgent: { name: "jose" } as any,
      history,
      phase: "enrichment",
      applicationId: "app-1",
      ...extra
    });
    return invokeLLM.firstCall;
  }

  it("has no turn cap: the 10th reply is still a normal FASE 2 turn", async () => {
    const call = await run(
      "mi negocio tiene 3 años",
      Array.from({ length: 9 }, () => exchange(true)).flat()
    );
    expect(call.args[2]).to.contain("FASE 2");
    expect(call.args[2]).to.not.contain("Es momento de enviar");
    expect(call.args[4]).to.include({
      submitted: true,
      profile: "PROSPECT",
      applicationId: "app-1"
    });
  });

  it("a decline closes José's questions and says the application is not cancelled", async () => {
    const call = await run("no gracias, ya no quiero seguir", exchange(true));
    expect(call.args[2]).to.contain("YA está enviada y NO se cancela");
    expect(call.args[2]).to.not.contain('outcome "abandoned"');
  });

  it("a stuck conversation closes José's questions, never abandons", async () => {
    const history = [...exchange(true), ...exchange(false), ...exchange(false), ...exchange(false)];
    const call = await run("jaja", history);
    expect(call.args[2]).to.contain("sigue enviada");
    expect(call.args[2]).to.not.contain('outcome "abandoned"');
  });

  it("greets a web-form applicant on José's first message", async () => {
    const call = await run("hola", []);
    expect(call.args[2]).to.contain("formulario web");
    expect(call.args[2]).to.contain("getApplicationState");
  });

  it("passes the turn's image so José can take the applicant's documents", async () => {
    const call = await run("mi cédula", exchange(true), { imageUrl: "data:image/png;base64,AAA" });
    expect(call.args[3]).to.equal("data:image/png;base64,AAA");
    expect(call.args[4]).to.include({ imageDataUrl: "data:image/png;base64,AAA" });
  });
});
