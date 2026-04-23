/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { Request } from "express";
import * as jose from "jose";
import { getConfig, type DbClient, type Role } from "@mikro/common";
import { prisma } from "../db.js";

/**
 * Identity extracted from a valid Bearer JWT.
 */
interface JwtIdentity {
  userId: string;
  roles: Role[];
}

const VALID_ROLES: Role[] = ["ADMIN", "COLLECTOR", "REFERRER"];

/**
 * Validates Bearer JWT and returns the caller's identity if valid.
 * Roles are read from the JWT claim (issued by createLogin at sign-in time).
 */
async function validateJwt(authHeader: string | undefined): Promise<JwtIdentity | null> {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  const token = authHeader.slice(7).trim();
  if (!token) return null;
  try {
    const config = getConfig() as { jwtSecret: string };
    const secret = new TextEncoder().encode(config.jwtSecret);
    const { payload } = await jose.jwtVerify(token, secret);
    const sub = payload.sub;
    if (typeof sub !== "string" || !sub) return null;
    const rawRoles = Array.isArray(payload.roles) ? payload.roles : [];
    const roles = rawRoles.filter(
      (r): r is Role => typeof r === "string" && (VALID_ROLES as string[]).includes(r)
    );
    return { userId: sub, roles };
  } catch {
    return null;
  }
}

/**
 * Context available to all tRPC procedures.
 *
 * When `isAuthenticated` is true, `userId` and `roles` are populated from the
 * verified Bearer JWT. `protectedProcedure` narrows those to non-optional.
 */
export interface Context {
  db: DbClient;
  isAuthenticated: boolean;
  userId?: string;
  roles: Role[];
}

/**
 * Creates context for each tRPC request. Only Bearer JWT is accepted.
 */
export async function createContext({ req }: { req: Request }): Promise<Context> {
  const authHeader = req.headers.authorization;
  const identity = await validateJwt(authHeader);
  return {
    db: prisma as unknown as DbClient,
    isAuthenticated: !!identity,
    userId: identity?.userId,
    roles: identity?.roles ?? []
  };
}
