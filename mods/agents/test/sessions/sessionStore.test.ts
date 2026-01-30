/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import { isNewSession, touchSession } from "../../src/sessions/sessionStore.js";

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
      const originalTimeout = process.env.MIKRO_SESSION_TIMEOUT_SECONDS;
      process.env.MIKRO_SESSION_TIMEOUT_SECONDS = "1";
      try {
        touchSession(id);
        expect(isNewSession(id)).to.be.false;
        await new Promise((resolve) => setTimeout(resolve, 1100));
        expect(isNewSession(id)).to.be.true;
      } finally {
        if (originalTimeout !== undefined) {
          process.env.MIKRO_SESSION_TIMEOUT_SECONDS = originalTimeout;
        } else {
          delete process.env.MIKRO_SESSION_TIMEOUT_SECONDS;
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
