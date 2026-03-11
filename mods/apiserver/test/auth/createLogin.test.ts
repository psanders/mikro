/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import sinon from "sinon";
import bcrypt from "bcryptjs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { clearConfigCache, ValidationError } from "@mikro/common";
import { createLogin } from "../../src/api/auth/createLogin.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("createLogin", () => {
  const hashedPassword = bcrypt.hashSync("correct-password", 10);

  const mockUser = {
    id: "550e8400-e29b-41d4-a716-446655440000",
    name: "Test User",
    phone: "+18091234567",
    password: hashedPassword,
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    roles: [{ role: "ADMIN" as const }]
  };

  let savedConfigFile: string | undefined;

  before(() => {
    savedConfigFile = process.env.MIKRO_CONFIG_FILE;
    process.env.MIKRO_CONFIG_FILE = resolve(__dirname, "../../../../mikro.json");
    clearConfigCache();
  });

  after(() => {
    if (savedConfigFile !== undefined) {
      process.env.MIKRO_CONFIG_FILE = savedConfigFile;
    } else {
      delete process.env.MIKRO_CONFIG_FILE;
    }
    clearConfigCache();
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("with valid credentials", () => {
    it("should return a JWT token on successful login", async () => {
      const mockClient = {
        user: { findFirst: sinon.stub().resolves(mockUser) }
      };
      const login = createLogin(mockClient as any);

      const result = await login({ phone: "+18091234567", password: "correct-password" });

      expect(result).to.have.property("token");
      expect(result.token).to.be.a("string");
      expect(result.token.split(".")).to.have.length(3);
      expect(mockClient.user.findFirst.calledOnce).to.be.true;
    });
  });

  describe("with invalid credentials", () => {
    it("should throw for wrong password", async () => {
      const mockClient = {
        user: { findFirst: sinon.stub().resolves(mockUser) }
      };
      const login = createLogin(mockClient as any);

      try {
        await login({ phone: "+18091234567", password: "wrong-password" });
        expect.fail("Expected error to be thrown");
      } catch (error) {
        expect((error as Error).message).to.equal("Invalid phone or password");
      }
    });

    it("should throw for non-existent user", async () => {
      const mockClient = {
        user: { findFirst: sinon.stub().resolves(null) }
      };
      const login = createLogin(mockClient as any);

      try {
        await login({ phone: "+18091234567", password: "any-password" });
        expect.fail("Expected error to be thrown");
      } catch (error) {
        expect((error as Error).message).to.equal("Invalid phone or password");
      }
    });

    it("should throw for user without password set", async () => {
      const userNoPassword = { ...mockUser, password: null };
      const mockClient = {
        user: { findFirst: sinon.stub().resolves(userNoPassword) }
      };
      const login = createLogin(mockClient as any);

      try {
        await login({ phone: "+18091234567", password: "any-password" });
        expect.fail("Expected error to be thrown");
      } catch (error) {
        expect((error as Error).message).to.equal("Invalid phone or password");
      }
    });

    it("should throw for disabled user", async () => {
      const disabledUser = { ...mockUser, enabled: false };
      const mockClient = {
        user: { findFirst: sinon.stub().resolves(disabledUser) }
      };
      const login = createLogin(mockClient as any);

      try {
        await login({ phone: "+18091234567", password: "correct-password" });
        expect.fail("Expected error to be thrown");
      } catch (error) {
        expect((error as Error).message).to.equal("Account is disabled");
      }
    });
  });

  describe("with invalid input", () => {
    it("should throw ValidationError for empty phone", async () => {
      const mockClient = {
        user: { findFirst: sinon.stub() }
      };
      const login = createLogin(mockClient as any);

      try {
        await login({ phone: "", password: "any-password" });
        expect.fail("Expected ValidationError to be thrown");
      } catch (error) {
        expect(error).to.be.instanceOf(ValidationError);
        expect(mockClient.user.findFirst.called).to.be.false;
      }
    });

    it("should throw ValidationError for empty password", async () => {
      const mockClient = {
        user: { findFirst: sinon.stub() }
      };
      const login = createLogin(mockClient as any);

      try {
        await login({ phone: "+18091234567", password: "" });
        expect.fail("Expected ValidationError to be thrown");
      } catch (error) {
        expect(error).to.be.instanceOf(ValidationError);
        expect(mockClient.user.findFirst.called).to.be.false;
      }
    });
  });

  describe("when client throws an error", () => {
    it("should propagate the error", async () => {
      const mockClient = {
        user: {
          findFirst: sinon.stub().rejects(new Error("Database error"))
        }
      };
      const login = createLogin(mockClient as any);

      try {
        await login({ phone: "+18091234567", password: "any-password" });
        expect.fail("Expected error to be thrown");
      } catch (error) {
        expect((error as Error).message).to.equal("Database error");
      }
    });
  });
});
