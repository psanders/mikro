/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { input, password, select, number } from "@inquirer/prompts";

/**
 * Prompts for a value if it's missing, otherwise returns the provided value.
 * Throws an error if value is missing and not running in a TTY.
 */
export async function promptIfMissing<T>(
  value: T | undefined,
  promptFn: () => Promise<T>,
  flagName: string
): Promise<T> {
  if (value !== undefined) {
    return value;
  }

  if (!process.stdout.isTTY) {
    throw new Error(`Missing required flag: --${flagName}`);
  }

  return promptFn();
}

/**
 * Helper to prompt for text input if missing
 */
export async function promptTextIfMissing(
  value: string | undefined,
  message: string,
  flagName: string,
  options?: { required?: boolean; default?: string }
): Promise<string> {
  return promptIfMissing(
    value,
    () => input({ message, required: options?.required ?? true, default: options?.default }),
    flagName
  );
}

/**
 * Helper to prompt for password if missing
 */
export async function promptPasswordIfMissing(
  value: string | undefined,
  message: string,
  flagName: string
): Promise<string> {
  return promptIfMissing(value, () => password({ message, mask: true }), flagName);
}

/**
 * Helper to prompt for number if missing
 */
export async function promptNumberIfMissing(
  value: number | undefined,
  message: string,
  flagName: string,
  options?: { required?: boolean }
): Promise<number> {
  if (value !== undefined) {
    return value;
  }

  if (!process.stdout.isTTY) {
    throw new Error(`Missing required flag: --${flagName}`);
  }

  const result = await number({ message, required: options?.required ?? true });
  if (result === undefined) {
    throw new Error(`Missing required flag: --${flagName}`);
  }
  return result;
}

/**
 * Helper to prompt for select if missing
 */
export async function promptSelectIfMissing<T>(
  value: T | undefined,
  message: string,
  flagName: string,
  choices: Array<{ name: string; value: T }>,
  options?: { default?: T }
): Promise<T> {
  return promptIfMissing(
    value,
    () => select({ message, choices, default: options?.default }),
    flagName
  );
}

export type UserRole = "ADMIN" | "COLLECTOR" | "REFERRER";

type ListUsersClient = {
  listUsers: {
    query: (input: {
      showDisabled?: boolean;
    }) => Promise<Array<{ id: string; name: string; roles?: Array<{ role: string }> }>>;
  };
};

/**
 * Helper to prompt for user selection (dropdown) if value is missing.
 * Fetches users from the API and optionally filters by role.
 */
export async function promptUserSelectIfMissing(
  client: ListUsersClient,
  value: string | undefined,
  message: string,
  flagName: string,
  options?: { role?: UserRole }
): Promise<string> {
  if (value !== undefined && value !== "") {
    return value;
  }

  if (!process.stdout.isTTY) {
    throw new Error(`Missing required flag or argument: --${flagName}`);
  }

  const users = await client.listUsers.query({ showDisabled: true });
  let filtered = users;
  if (options?.role) {
    filtered = users.filter((u) => u.roles?.some((r) => r.role === options!.role));
  }

  if (filtered.length === 0) {
    const roleHint = options?.role ? ` with role ${options.role}` : "";
    throw new Error(`No users found${roleHint}. Cannot prompt for selection.`);
  }

  const choice = await select({
    message,
    choices: filtered.map((u) => ({
      name: `${u.name} (${u.id})`,
      value: u.id
    }))
  });

  return choice;
}
