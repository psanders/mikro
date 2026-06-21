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
import {
  handleProspectMessage,
  clearProspectHistory
} from "../../src/whatsapp/handleProspectMessage.js";
import { clearSessionsForTesting } from "../../src/sessions/sessionStore.js";

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
  whatsapp: { phoneNumberId: "test", accessToken: "test" }
};

describe("handleProspectMessage turn cap", () => {
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
    clearProspectHistory(PHONE);
    clearSessionsForTesting();
  });
  afterEach(() => sinon.restore());

  function makeDeps() {
    // Report a saveAnswer each turn so the stuck-counter never fires; we are
    // isolating the hard turn cap.
    const invokeLLM = sinon
      .stub()
      .resolves({ text: "Anotado. ¿siguiente?", toolsExecuted: [{ name: "saveAnswer" }] });
    return { invokeLLM, joseAgent: { name: "jose" } as any };
  }

  it("does not force finalize during the first 6 turns", async () => {
    const deps = makeDeps();
    for (let i = 0; i < 6; i++) {
      await handleProspectMessage(PHONE, SESSION, `respuesta ${i}`, deps);
    }
    for (const call of deps.invokeLLM.getCalls()) {
      expect(call.args[2]).to.not.contain("Límite de turnos");
    }
  });

  it("injects the finalize directive on the 7th turn", async () => {
    const deps = makeDeps();
    for (let i = 0; i < 7; i++) {
      await handleProspectMessage(PHONE, SESSION, `respuesta ${i}`, deps);
    }
    const seventh = deps.invokeLLM.getCall(6);
    expect(seventh.args[2]).to.contain("Límite de turnos alcanzado");
    // The prospect's original text is preserved after the directive.
    expect(seventh.args[2]).to.contain("respuesta 6");
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
    clearProspectHistory(PHONE);
    clearSessionsForTesting();
  });
  afterEach(() => sinon.restore());

  function makeDeps() {
    const invokeLLM = sinon
      .stub()
      .resolves({ text: "Entendido, que estés bien.", toolsExecuted: [] });
    return { invokeLLM, joseAgent: { name: "jose" } as any };
  }

  [
    "La verdad ya no me interesa",
    "No quiero el préstamo",
    "déjenme tranquilo",
    "No, gracias"
  ].forEach((msg) => {
    it(`injects the abandon directive for: "${msg}"`, async () => {
      const deps = makeDeps();
      await handleProspectMessage(PHONE, SESSION, msg, deps);
      const arg = deps.invokeLLM.getCall(0).args[2] as string;
      expect(arg).to.contain("NO está interesado");
      expect(arg).to.contain(msg);
    });
  });

  it("does NOT treat a plain 'no' answer as a decline (no false positive)", async () => {
    const deps = makeDeps();
    await handleProspectMessage(PHONE, SESSION, "No", deps);
    const arg = deps.invokeLLM.getCall(0).args[2] as string;
    expect(arg).to.not.contain("NO está interesado");
    expect(arg).to.equal("No");
  });
});
