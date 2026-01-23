/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { Role } from "../schemas/user.js";

/**
 * User entity type.
 */
export interface User {
  id: string;
  name: string;
  phone?: string | null;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * User with role information.
 */
export interface UserWithRole extends User {
  role?: Role | null;
}
