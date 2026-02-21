/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import bcrypt from "bcryptjs";
import * as jose from "jose";
import {
  withErrorHandlingAndValidation,
  getConfig,
  loginSchema,
  type LoginInput,
  type DbClient,
  type Role
} from "@mikro/common";
import { logger } from "../../logger.js";

/** User from DB with password and roles (for login). */
interface UserWithPassword {
  id: string;
  phone: string;
  password: string | null;
  enabled: boolean;
  roles: Array<{ role: Role }>;
}

export interface LoginResult {
  token: string;
}

/**
 * Creates a function to authenticate a user by phone and password.
 * Returns a signed JWT for use as Bearer token.
 *
 * @param client - The database client
 * @returns A validated function that performs login
 */
export function createLogin(client: DbClient) {
  const fn = async (params: LoginInput): Promise<LoginResult> => {
    const { phone, password } = params;
    logger.verbose("login attempt", { phone });

    const user = (await client.user.findFirst({
      where: { phone },
      include: {
        roles: { select: { role: true } }
      }
    })) as UserWithPassword | null;

    if (!user || !user.password) {
      logger.verbose("login failed: user not found or no password", { phone });
      throw new Error("Invalid phone or password");
    }

    if (!user.enabled) {
      logger.verbose("login failed: user disabled", { phone });
      throw new Error("Account is disabled");
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      logger.verbose("login failed: invalid password", { phone });
      throw new Error("Invalid phone or password");
    }

    const config = getConfig() as { jwtSecret: string; jwtExpiresIn: string };
    const secret = new TextEncoder().encode(config.jwtSecret);
    const roles = (user.roles ?? []).map((r) => r.role as Role);
    const token = await new jose.SignJWT({
      phone: user.phone,
      roles
    })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(user.id)
      .setIssuedAt()
      .setExpirationTime(config.jwtExpiresIn)
      .sign(secret);

    logger.verbose("login success", { userId: user.id, phone: user.phone });
    return { token };
  };

  return withErrorHandlingAndValidation(fn, loginSchema);
}
