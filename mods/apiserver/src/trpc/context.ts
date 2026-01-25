/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { Request } from "express";
import type { DbClient } from "@mikro/common";
import { prisma } from "../db.js";

/**
 * Validates Basic Auth header against MIKRO_CREDENTIALS env var.
 * @param authHeader - The Authorization header value
 * @returns true if credentials match, false otherwise
 */
function validateBasicAuth(authHeader: string | undefined): boolean {
  if (!authHeader || !authHeader.startsWith("Basic ")) {
    return false;
  }

  const expectedCredentials = process.env.MIKRO_CREDENTIALS;
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
}

/**
 * Creates context for each tRPC request.
 * @param opts - Request options containing the Express request
 * @returns Context with db client and authentication status
 */
export function createContext({ req }: { req: Request }): Context {
  const authHeader = req.headers.authorization;
  const isAuthenticated = validateBasicAuth(authHeader);
  // Cast prisma to DbClient - the interfaces are compatible at runtime
  // but have minor type differences (e.g., Decimal vs number)
  return { db: prisma as unknown as DbClient, isAuthenticated };
}
