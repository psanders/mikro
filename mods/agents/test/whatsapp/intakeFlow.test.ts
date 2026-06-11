/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import {
  buildIntakeFlowMessage,
  mapFlowAnswersToPayload,
  INTAKE_FLOW_SCREEN
} from "../../src/whatsapp/intakeFlow.js";

describe("intakeFlow", () => {
  describe("buildIntakeFlowMessage", () => {
    it("builds an interactive flow message opening the intake screen", () => {
      const msg = buildIntakeFlowMessage("+18095551234", "flow-abc");
      expect(msg.phone).to.equal("+18095551234");
      expect(msg.flow).to.exist;
      expect(msg.flow?.flowId).to.equal("flow-abc");
      expect(msg.flow?.screen).to.equal(INTAKE_FLOW_SCREEN);
      expect(msg.flow?.cta).to.be.a("string").and.not.empty;
      expect(msg.flow?.body).to.be.a("string").and.not.empty;
      // flowToken correlates by phone
      expect(msg.flow?.flowToken).to.contain("+18095551234");
    });
  });

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
});
