/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import {
  flowReplyFor,
  INTAKE_IN_PROCESS_MESSAGE,
  INTAKE_RECEIVED_MESSAGE,
  mapFlowAnswersToPayload
} from "../../src/whatsapp/loanApplicationFlowSubmission.js";

describe("loanApplicationFlowSubmission", () => {
  describe("mapFlowAnswersToPayload", () => {
    const baseAnswers = {
      firstName: "Juan",
      lastName: "Pérez",
      businessType: "COLMADO",
      monthlySales: "RD$50,000 – RD$100,000",
      requestedAmount: "30000",
      requestedTermWeeks: "12 semanas"
    };

    it("injects phone, sessionId, and partial:false", () => {
      const p = mapFlowAnswersToPayload(baseAnswers, "+18095551234", "wa-msg-1");
      expect(p.sessionId).to.equal("wa-msg-1");
      expect(p.phone).to.equal("+18095551234");
      expect(p.partial).to.equal(false);
      expect(p.firstName).to.equal("Juan");
      expect(p.businessType).to.equal("COLMADO");
    });

    it("converts a DatePicker epoch-ms value to ISO yyyy-mm-dd", () => {
      // 1990-01-15T00:00:00Z = 632361600000
      const p = mapFlowAnswersToPayload(
        { ...baseAnswers, dateOfBirth: "632361600000" },
        "+18095551234",
        "wa-msg-1"
      );
      expect(p.dateOfBirth).to.equal("1990-01-15");
    });

    it("passes through an already-ISO date unchanged", () => {
      const p = mapFlowAnswersToPayload(
        { ...baseAnswers, dateOfBirth: "1990-01-15" },
        "+18095551234",
        "wa-msg-1"
      );
      expect(p.dateOfBirth).to.equal("1990-01-15");
    });

    it("ignores a phone field coming from the form (sender phone wins)", () => {
      const p = mapFlowAnswersToPayload(
        { ...baseAnswers, phone: "(000) 000-0000" },
        "+18095551234",
        "wa-msg-1"
      );
      expect(p.phone).to.equal("+18095551234");
    });

    it("stringifies non-string values and drops empty/nullish ones", () => {
      const p = mapFlowAnswersToPayload(
        { ...baseAnswers, requestedAmount: 30000, spouseName: "", referenceName: null },
        "+18095551234",
        "wa-msg-1"
      );
      expect(p.requestedAmount).to.equal("30000");
      expect(p).to.not.have.property("spouseName");
      expect(p).to.not.have.property("referenceName");
    });
  });

  describe("flowReplyFor (issue #302)", () => {
    const reapplyFrom = new Date("2026-10-26T12:00:00Z");

    it("confirms a received application", () => {
      expect(flowReplyFor({ outcome: "received" })).to.equal(INTAKE_RECEIVED_MESSAGE);
      expect(flowReplyFor(undefined)).to.equal(INTAKE_RECEIVED_MESSAGE);
    });

    it("gives a recently rejected person the date they may apply again", () => {
      const reply = flowReplyFor({ outcome: "cooldown", reapplyFrom });
      expect(reply).to.contain("no fue aprobada");
      expect(reply).to.contain("a partir del 26 de octubre de 2026");
    });

    it("explains the coverage area to an out-of-area rejection, with the same date", () => {
      const reply = flowReplyFor({ outcome: "cooldown", reapplyFrom, outOfArea: true });
      expect(reply).to.contain("Puerto Plata");
      expect(reply).to.not.contain("no fue aprobada");
      expect(reply).to.contain("a partir del 26 de octubre de 2026");
    });

    it("tells someone with an application in process that no other was created", () => {
      expect(flowReplyFor({ outcome: "in_process" })).to.equal(INTAKE_IN_PROCESS_MESSAGE);
    });
  });
});
