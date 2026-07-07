/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import { buildCopilotSystemPrompt } from "../../src/api/copilot/systemPrompt.js";

describe("buildCopilotSystemPrompt", () => {
  it("includes today's date and the base verb guidance", () => {
    const prompt = buildCopilotSystemPrompt({ today: "5 de julio de 2026" });

    expect(prompt).to.include("Hoy es 5 de julio de 2026.");
    expect(prompt).to.include("CONSULTAR");
    expect(prompt).to.include("VIGILAR");
    expect(prompt).to.include("PROGRAMAR");
    expect(prompt).to.include("MEJORAR");
    expect(prompt).to.include("githubFeedback");
    expect(prompt).to.include("createTask");
  });

  it("includes receipt-sending guidance (issue #118)", () => {
    const prompt = buildCopilotSystemPrompt({ today: "5 de julio de 2026" });

    expect(prompt).to.include("sendReceiptViaWhatsApp");
    expect(prompt).to.include("listPaymentsByLoanId");
  });

  it("mentions the founder's name when known", () => {
    const withName = buildCopilotSystemPrompt({ today: "5 de julio de 2026", actorName: "Pedro" });
    const withoutName = buildCopilotSystemPrompt({ today: "5 de julio de 2026" });

    expect(withName).to.include("Pedro");
    expect(withoutName).to.not.include("El fundador con el que hablas se llama");
  });

  it("includes disambiguation notes for bound tools that have one", () => {
    const prompt = buildCopilotSystemPrompt({ today: "5 de julio de 2026" });

    // getCustomer and getApplicationById are both bound read tools with a
    // TOOL_NOTES entry — their disambiguation should show up.
    expect(prompt).to.include("getCustomer:");
    expect(prompt).to.include("getApplicationById:");
  });

  it("does not include notes for tools that aren't bound to the model", () => {
    const prompt = buildCopilotSystemPrompt({ today: "5 de julio de 2026" });

    // getApplicationState exists in the shared agents registry but is never
    // bound to the copilot policy — it must never appear in the prompt.
    expect(prompt).to.not.include("getApplicationState");
  });
});
