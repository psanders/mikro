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

/**
 * Helper to prompt for a date string (YYYY-MM-DD) if missing. Returns the raw string.
 */
export async function promptDateIfMissing(
  value: string | undefined,
  message: string,
  flagName: string,
  options?: { default?: string }
): Promise<string> {
  const today = new Date().toISOString().slice(0, 10);
  return promptIfMissing(
    value,
    () =>
      input({
        message,
        default: options?.default ?? today,
        validate: (v) => {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return "Expected format YYYY-MM-DD";
          if (isNaN(new Date(v).getTime())) return `Invalid date: ${v}`;
          return true;
        }
      }),
    flagName
  );
}

type ListAccountsClient = {
  accounting: {
    listAccounts: {
      query: (input: {
        includeInactive?: boolean;
      }) => Promise<
        Array<{ id: string; name: string; kind: string; currency: string; currentBalance: number }>
      >;
    };
  };
};

/**
 * Helper to prompt for an accounting account if missing.
 */
export async function promptAccountSelectIfMissing(
  client: ListAccountsClient,
  value: string | undefined,
  message: string,
  flagName: string,
  options?: { includeInactive?: boolean }
): Promise<string> {
  if (value !== undefined && value !== "") return value;
  if (!process.stdout.isTTY) {
    throw new Error(`Missing required flag or argument: --${flagName}`);
  }
  const accounts = await client.accounting.listAccounts.query({
    includeInactive: options?.includeInactive ?? false
  });
  if (accounts.length === 0) {
    throw new Error(
      "No accounting accounts found. Create one first with `mikro accounting:accounts:create`."
    );
  }
  return select({
    message,
    choices: accounts.map((a) => ({
      name: `${a.name} (${a.kind}, ${a.currency} ${a.currentBalance.toFixed(2)})`,
      value: a.id
    }))
  });
}

type ListCategoriesClient = {
  accounting: {
    listCategories: {
      query: (input: {
        kind?: "EXPENSE" | "INCOME";
      }) => Promise<Array<{ id: string; name: string; kind: string }>>;
    };
  };
};

/**
 * Helper to prompt for an accounting category if missing. Returns null if user picks "(none)".
 */
export async function promptCategorySelectIfMissing(
  client: ListCategoriesClient,
  value: string | undefined,
  message: string,
  flagName: string,
  options?: { kind?: "EXPENSE" | "INCOME"; allowNone?: boolean }
): Promise<string | undefined> {
  if (value !== undefined && value !== "") return value;
  if (!process.stdout.isTTY) {
    return undefined;
  }
  const categories = await client.accounting.listCategories.query({
    kind: options?.kind
  });
  if (categories.length === 0) {
    if (options?.allowNone) return undefined;
    throw new Error(
      "No categories found. Create one first with `mikro accounting:categories:create`."
    );
  }
  const noneChoice = [{ name: "(none)", value: "__none__" }];
  const choices = options?.allowNone
    ? [...noneChoice, ...categories.map((c) => ({ name: `${c.name} (${c.kind})`, value: c.id }))]
    : categories.map((c) => ({ name: `${c.name} (${c.kind})`, value: c.id }));
  const chosen = await select({ message, choices });
  return chosen === "__none__" ? undefined : chosen;
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
