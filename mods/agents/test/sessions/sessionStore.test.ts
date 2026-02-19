/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import { writeFileSync, unlinkSync, existsSync } from "fs";
import { resolve } from "path";
import { clearConfigCache, getConfig } from "@mikro/common";
import { isNewSession, touchSession } from "../../src/sessions/sessionStore.js";

/** Path to a temporary mikro.json used only by this test suite. */
const TEST_CONFIG_PATH = resolve(process.cwd(), "mikro-test-session.json");

/**
 * Build a minimal mikro.json object with the given session timeout.
 * All required fields are filled with dummy values.
 */
function makeTestConfig(sessionTimeoutSeconds: number): object {
  return {
    sessionTimeoutSeconds,
    llm: {
      text: { vendor: "openai", apiKey: "test-key", model: "gpt-4o-mini" },
      vision: { vendor: "openai", apiKey: "test-key", model: "gpt-4o" },
      evals: { vendor: "openai", apiKey: "test-key", model: "gpt-4o-mini" }
    },
    whatsapp: {
      phoneNumberId: "test",
      accessToken: "test"
    }
  };
}

describe("sessionStore", () => {
  const uniqueKey = () => `test-session-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  describe("isNewSession", () => {
    it("returns true when identifier has no session", () => {
      expect(isNewSession(uniqueKey())).to.be.true;
    });

    it("returns false immediately after touchSession", () => {
      const id = uniqueKey();
      touchSession(id);
      expect(isNewSession(id)).to.be.false;
    });

    it("returns true after session timeout has elapsed", async function () {
      this.timeout(3000);
      const id = uniqueKey();

      // Write a temporary config with a 1-second timeout and load it
      writeFileSync(TEST_CONFIG_PATH, JSON.stringify(makeTestConfig(1)));
      clearConfigCache();
      getConfig(TEST_CONFIG_PATH);

      try {
        touchSession(id);
        expect(isNewSession(id)).to.be.false;
        await new Promise((resolve) => setTimeout(resolve, 1100));
        expect(isNewSession(id)).to.be.true;
      } finally {
        clearConfigCache();
        if (existsSync(TEST_CONFIG_PATH)) {
          unlinkSync(TEST_CONFIG_PATH);
        }
      }
    });
  });

  describe("touchSession", () => {
    it("updates session so isNewSession returns false", () => {
      const id = uniqueKey();
      touchSession(id);
      expect(isNewSession(id)).to.be.false;
      touchSession(id);
      expect(isNewSession(id)).to.be.false;
    });
  });
});
