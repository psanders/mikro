/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  decodeJwtPayload,
  decodeRolesFromToken,
  hasEvaluatorRole,
  isDualRole,
  activeRoleLabel,
  canManagePayments
} from "../auth";

/** Builds a JWT-shaped string (header.payload.signature) without a real signature, for decode tests. */
function makeToken(payload: unknown): string {
  const b64url = (value: string) =>
    Buffer.from(value, "utf8")
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(typeof payload === "string" ? payload : JSON.stringify(payload));
  return `${header}.${body}.fakesignature`;
}

describe("decodeJwtPayload", () => {
  it("decodes a well-formed payload", () => {
    const token = makeToken({ sub: "u1", roles: ["REVIEWER"], exp: 9999999999 });
    expect(decodeJwtPayload(token)).toEqual({ sub: "u1", roles: ["REVIEWER"], exp: 9999999999 });
  });

  it("decodes multi-byte UTF-8 characters in the payload correctly", () => {
    const token = makeToken({ sub: "u1", phone: "Peña Núñez", roles: ["ADMIN"] });
    expect(decodeJwtPayload(token)?.phone).toBe("Peña Núñez");
  });

  it("returns null for a token that does not have 3 dot-separated segments", () => {
    expect(decodeJwtPayload("not-a-jwt")).toBeNull();
    expect(decodeJwtPayload("only.two")).toBeNull();
    expect(decodeJwtPayload("")).toBeNull();
  });

  it("returns null when the payload segment is not valid base64/JSON", () => {
    expect(decodeJwtPayload("header.!!!not-base64-json!!!.sig")).toBeNull();
  });

  it("returns null when the decoded payload is valid JSON but not an object", () => {
    expect(decodeJwtPayload(makeToken("42"))).toBeNull();
    expect(decodeJwtPayload(makeToken("null"))).toBeNull();
    expect(decodeJwtPayload(makeToken('"a string"'))).toBeNull();
    expect(decodeJwtPayload(makeToken("[1,2,3]"))).not.toBeNull(); // arrays are typeof "object"
  });

  it("does not throw on garbage input", () => {
    expect(() => decodeJwtPayload("")).not.toThrow();
    expect(() => decodeJwtPayload("a.b.c")).not.toThrow();
    expect(() => decodeJwtPayload("....")).not.toThrow();
  });
});

describe("decodeRolesFromToken", () => {
  it("extracts roles from a valid token", () => {
    const token = makeToken({ sub: "u1", roles: ["REVIEWER", "COLLECTOR"] });
    expect(decodeRolesFromToken(token)).toEqual(["REVIEWER", "COLLECTOR"]);
  });

  it("returns an empty array — not a throw — when the token is malformed", () => {
    expect(decodeRolesFromToken("not-a-jwt")).toEqual([]);
    expect(decodeRolesFromToken("")).toEqual([]);
    expect(decodeRolesFromToken("header.!!!garbage!!!.sig")).toEqual([]);
  });

  it("returns an empty array — not a throw — when the roles claim is missing", () => {
    const token = makeToken({ sub: "u1" });
    expect(decodeRolesFromToken(token)).toEqual([]);
  });

  it("returns an empty array — not a throw — when the roles claim is present but not an array", () => {
    const token = makeToken({ sub: "u1", roles: "REVIEWER" });
    expect(decodeRolesFromToken(token)).toEqual([]);
  });

  it("never throws regardless of input shape", () => {
    expect(() => decodeRolesFromToken("garbage")).not.toThrow();
    expect(() => decodeRolesFromToken(makeToken({ roles: null }))).not.toThrow();
    expect(() => decodeRolesFromToken(makeToken({ roles: 42 }))).not.toThrow();
  });
});

describe("hasEvaluatorRole", () => {
  it("is true for REVIEWER", () => {
    expect(hasEvaluatorRole(["REVIEWER"])).toBe(true);
  });

  it("is true for ADMIN", () => {
    expect(hasEvaluatorRole(["ADMIN"])).toBe(true);
  });

  it("is false for COLLECTOR-only", () => {
    expect(hasEvaluatorRole(["COLLECTOR"])).toBe(false);
  });

  it("is false for an empty role list", () => {
    expect(hasEvaluatorRole([])).toBe(false);
  });
});

describe("isDualRole", () => {
  it("is true when COLLECTOR is combined with REVIEWER", () => {
    expect(isDualRole(["COLLECTOR", "REVIEWER"])).toBe(true);
  });

  it("is true when COLLECTOR is combined with ADMIN", () => {
    expect(isDualRole(["COLLECTOR", "ADMIN"])).toBe(true);
  });

  it("is false for COLLECTOR-only", () => {
    expect(isDualRole(["COLLECTOR"])).toBe(false);
  });

  it("is false for REVIEWER-only (no COLLECTOR)", () => {
    expect(isDualRole(["REVIEWER"])).toBe(false);
  });

  // mikro/#70: ADMIN has server-side access to both surfaces even without an
  // explicit COLLECTOR row, so ADMIN-only must also show the mode switch.
  it("is true for ADMIN-only (no explicit COLLECTOR row)", () => {
    expect(isDualRole(["ADMIN"])).toBe(true);
  });
});

describe("activeRoleLabel", () => {
  it("labels ADMIN as Administrador when in evaluator mode", () => {
    expect(activeRoleLabel(["ADMIN"], "evaluator", true)).toBe("Administrador");
  });

  it("labels ADMIN as Cobrador when switched to collector mode (dual-role)", () => {
    expect(activeRoleLabel(["ADMIN"], "collector", true)).toBe("Cobrador");
  });

  it("labels REVIEWER-only as Evaluador", () => {
    expect(activeRoleLabel(["REVIEWER"], "evaluator", false)).toBe("Evaluador");
  });

  it("labels COLLECTOR-only as Cobrador", () => {
    expect(activeRoleLabel(["COLLECTOR"], "evaluator", false)).toBe("Cobrador");
  });

  it("prefers Administrador over Evaluador when both ADMIN and REVIEWER are present", () => {
    expect(activeRoleLabel(["ADMIN", "REVIEWER"], "evaluator", false)).toBe("Administrador");
  });
});

describe("canManagePayments", () => {
  it("is true for COLLECTOR", () => {
    expect(canManagePayments(["COLLECTOR"])).toBe(true);
  });

  it("is true for ADMIN", () => {
    expect(canManagePayments(["ADMIN"])).toBe(true);
  });

  it("is false for REVIEWER-only — must not see payment data (mikro/#73)", () => {
    expect(canManagePayments(["REVIEWER"])).toBe(false);
  });

  it("is false for an empty role list", () => {
    expect(canManagePayments([])).toBe(false);
  });
});
