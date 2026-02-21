/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { Request } from "express";
import * as jose from "jose";
import { getConfig, type DbClient } from "@mikro/common";
import { prisma } from "../db.js";

/**
 * Validates Bearer JWT and returns the subject (user id) if valid.
 * @param authHeader - The Authorization header value
 * @returns userId if token is valid, null otherwise
 */
async function validateJwt(authHeader: string | undefined): Promise<string | null> {
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
    return typeof sub === "string" ? sub : null;
  } catch {
    return null;
  }
}

/**
 * Validates Basic Auth header against config credentials.
 * @param authHeader - The Authorization header value
 * @returns true if credentials match, false otherwise
 */
function validateBasicAuth(authHeader: string | undefined): boolean {
  if (!authHeader || !authHeader.startsWith("Basic ")) {
    return false;
  }

  const expectedCredentials = getConfig().credentials;
  if (!expectedCredentials) {
    return false;
  }

  try {
    const base64Credentials = authHeader.slice(6); // Remove "Basic " prefix
    const credentials = Buffer.from(base64Credentials, "base64").toString("utf-8");
    return credentials === expectedCredentials;
  } catch {
    return false;
  }
}

/**
 * Context available to all tRPC procedures.
 */
export interface Context {
  db: DbClient;
  isAuthenticated: boolean;
  userId?: string;
}

/**
 * Creates context for each tRPC request.
 * Accepts either Bearer JWT (mobile) or Basic Auth (CLI).
 * @param opts - Request options containing the Express request
 * @returns Context with db client and authentication status
 */
export async function createContext({ req }: { req: Request }): Promise<Context> {
  const authHeader = req.headers.authorization;
  const baseContext = {
    db: prisma as unknown as DbClient,
    isAuthenticated: false as boolean,
    userId: undefined as string | undefined
  };

  // Bearer JWT takes precedence (for mobile app)
  if (authHeader?.startsWith("Bearer ")) {
    const userId = await validateJwt(authHeader);
    return {
      ...baseContext,
      isAuthenticated: !!userId,
      userId: userId ?? undefined
    };
  }

  // Fall back to Basic Auth (for CLI)
  const isAuthenticated = validateBasicAuth(authHeader);
  return { ...baseContext, isAuthenticated };
}
