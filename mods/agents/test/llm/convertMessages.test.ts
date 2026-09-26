/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * History → LangChain messages. Persisted transcripts (#299) can hold a turn
 * where the agent only ran tools and said nothing; Anthropic and Gemini reject
 * an empty assistant message, so it must never reach them.
 */
import { expect } from "chai";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { convertAllToLangChainMessages } from "../../src/llm/createInvokeLLM.js";

describe("convertAllToLangChainMessages", () => {
  it("skips an assistant turn with no text, keeping its tools as a note on the next user turn", () => {
    const out = convertAllToLangChainMessages([
      { role: "user", content: "vendo 50 mil" },
      {
        role: "assistant",
        content: "",
        tools_executed: [{ name: "saveAnswer", args: { monthlySales: 50000 } }]
      },
      { role: "user", content: "¿y ahora?" }
    ]);

    expect(out).to.have.length(2);
    expect(out.every((m) => m instanceof HumanMessage)).to.be.true;
    expect(String(out[1].content)).to.contain("saveAnswer");
    expect(String(out[1].content)).to.contain("¿y ahora?");
  });

  it("keeps assistant turns that have text", () => {
    const out = convertAllToLangChainMessages([
      { role: "user", content: "hola" },
      { role: "assistant", content: "¡Hola!" }
    ]);

    expect(out[1]).to.be.instanceOf(AIMessage);
    expect(out[1].content).to.equal("¡Hola!");
  });
});
