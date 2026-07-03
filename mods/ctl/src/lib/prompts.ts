/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { formatMoney, type ApplicationStatus } from "@mikro/common";
import { input, password, select, number } from "@inquirer/prompts";

/**
 * Parse a numeric loan ID from a positional argument or flag value.
 */
export function parseLoanIdArg(raw: string): number {
  const trimmed = raw.trim();
  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid loan ID: ${raw}. Expected a positive integer (e.g. 10001).`);
  }
  return parsed;
}

/**
 * Prompts for a positional argument if missing.
 */
export async function promptArgIfMissing(
  value: string | undefined,
  promptFn: () => Promise<string>,
  argName: string
): Promise<string> {
  if (value !== undefined && value !== "") {
    return value;
  }
  if (!process.stdout.isTTY) {
    throw new Error(`Missing required argument: ${argName}`);
  }
  return promptFn();
}

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
      name: `${a.name} (${a.kind}, ${a.currency} ${formatMoney(a.currentBalance)})`,
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

export type UserRole = "ADMIN" | "COLLECTOR" | "REVIEWER";

type ListUsersClient = {
  listUsers: {
    query: (input: {
      showDisabled?: boolean;
    }) => Promise<Array<{ id: string; name: string; roles?: Array<{ role: string }> }>>;
  };
};

/**
 * Helper to prompt for user selection (dropdown) if value is missing.
 * Fetches users from the API and optionally filters by role (`role` for a
 * single role, `roles` for "any of").
 */
export async function promptUserSelectIfMissing(
  client: ListUsersClient,
  value: string | undefined,
  message: string,
  flagName: string,
  options?: { role?: UserRole; roles?: UserRole[] }
): Promise<string> {
  if (value !== undefined && value !== "") {
    return value;
  }

  if (!process.stdout.isTTY) {
    throw new Error(`Missing required flag or argument: --${flagName}`);
  }

  const users = await client.listUsers.query({ showDisabled: true });
  const allowedRoles = options?.roles ?? (options?.role ? [options.role] : undefined);
  let filtered = users;
  if (allowedRoles) {
    filtered = users.filter((u) => u.roles?.some((r) => allowedRoles.includes(r.role as UserRole)));
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

type ListLoansClient = {
  listLoans: {
    query: (input: { showAll?: boolean; limit?: number }) => Promise<
      Array<{
        loanId: number;
        customer: { name: string };
        status: string;
        nickname?: string | null;
      }>
    >;
  };
};

/**
 * Helper to prompt for loan selection (numeric loan #) if a positional arg is missing.
 */
export async function promptLoanSelectIfMissing(
  client: ListLoansClient,
  value: string | undefined,
  message: string,
  argName: string,
  options?: { showAll?: boolean }
): Promise<number> {
  if (value !== undefined && value !== "") {
    return parseLoanIdArg(value);
  }
  if (!process.stdout.isTTY) {
    throw new Error(`Missing required argument: ${argName}`);
  }
  const loans = await client.listLoans.query({
    showAll: options?.showAll ?? false,
    limit: 100
  });
  if (loans.length === 0) {
    throw new Error("No loans found. Cannot prompt for selection.");
  }
  const choice = await select({
    message,
    choices: loans.map((l) => ({
      name: `#${l.loanId} — ${l.customer.name}${l.nickname ? ` (${l.nickname})` : ""} [${l.status}]`,
      value: String(l.loanId)
    }))
  });
  return parseLoanIdArg(choice);
}

type ListCustomersClient = {
  listCustomers: {
    query: (input: {
      showInactive?: boolean;
      limit?: number;
    }) => Promise<Array<{ id: string; name: string; phone: string; nickname?: string | null }>>;
  };
};

/**
 * Helper to prompt for customer selection if a positional arg is missing.
 */
export async function promptCustomerSelectIfMissing(
  client: ListCustomersClient,
  value: string | undefined,
  message: string,
  argName: string
): Promise<string> {
  if (value !== undefined && value !== "") {
    return value;
  }
  if (!process.stdout.isTTY) {
    throw new Error(`Missing required argument: ${argName}`);
  }
  const customers = await client.listCustomers.query({ showInactive: true, limit: 100 });
  if (customers.length === 0) {
    throw new Error("No customers found. Cannot prompt for selection.");
  }
  const choice = await select({
    message,
    choices: customers.map((c) => ({
      name: `${c.name}${c.nickname ? ` (${c.nickname})` : ""} — ${c.phone} (${c.id})`,
      value: c.id
    }))
  });
  return choice;
}

type ListApplicationsClient = {
  listApplications: {
    query: (input: { status?: ApplicationStatus; limit?: number }) => Promise<
      Array<{
        id: string;
        firstName: string | null;
        lastName: string | null;
        phone: string | null;
        status: string;
      }>
    >;
  };
};

/**
 * Helper to prompt for loan-application selection if a positional arg is
 * missing. `listApplications` only accepts one status per call, so this
 * shows every status by default; pass `status` to narrow the picker (e.g.
 * "RECEIVED" for `claim`, "DRAFT" for a promote-style flow).
 */
export async function promptApplicationSelectIfMissing(
  client: ListApplicationsClient,
  value: string | undefined,
  message: string,
  argName: string,
  options?: { status?: ApplicationStatus }
): Promise<string> {
  if (value !== undefined && value !== "") {
    return value;
  }
  if (!process.stdout.isTTY) {
    throw new Error(`Missing required argument: ${argName}`);
  }
  const apps = await client.listApplications.query({ status: options?.status, limit: 100 });
  if (apps.length === 0) {
    throw new Error("No applications found. Cannot prompt for selection.");
  }
  const choice = await select({
    message,
    choices: apps.map((a) => ({
      name: `${[a.firstName, a.lastName].filter(Boolean).join(" ") || "(no name)"} — ${a.phone ?? "no phone"} [${a.status}] (${a.id})`,
      value: a.id
    }))
  });
  return choice;
}

type ListPaymentsClient = {
  listPayments: {
    query: (input: {
      startDate: Date;
      endDate: Date;
      showReversed?: boolean;
      limit?: number;
    }) => Promise<
      Array<{
        id: string;
        loan: { loanId: number; customer: { name: string } };
        amount: unknown;
      }>
    >;
  };
};

/**
 * Helper to prompt for payment selection if a positional arg is missing.
 * Uses payments from the last 30 days.
 */
export async function promptPaymentSelectIfMissing(
  client: ListPaymentsClient,
  value: string | undefined,
  message: string,
  argName: string
): Promise<string> {
  if (value !== undefined && value !== "") {
    return value;
  }
  if (!process.stdout.isTTY) {
    throw new Error(`Missing required argument: ${argName}`);
  }
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 30);
  const payments = await client.listPayments.query({
    startDate: start,
    endDate: end,
    showReversed: false,
    limit: 100
  });
  if (payments.length === 0) {
    throw new Error("No recent payments found. Cannot prompt for selection.");
  }
  const choice = await select({
    message,
    choices: payments.map((p) => ({
      name: `${p.id.slice(0, 8)}… — loan #${p.loan.loanId} ${p.loan.customer.name}`,
      value: p.id
    }))
  });
  return choice;
}

type ListAccountingTransactionsClient = {
  accounting: {
    listTransactions: {
      query: (input: { startDate: Date; endDate: Date; limit?: number }) => Promise<
        Array<{
          id: string;
          type: string;
          amount: number;
          account: { name: string };
        }>
      >;
    };
  };
};

/**
 * Helper to prompt for accounting transaction selection if a positional arg is missing.
 */
export async function promptTransactionSelectIfMissing(
  client: ListAccountingTransactionsClient,
  value: string | undefined,
  message: string,
  argName: string
): Promise<string> {
  if (value !== undefined && value !== "") {
    return value;
  }
  if (!process.stdout.isTTY) {
    throw new Error(`Missing required argument: ${argName}`);
  }
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 90);
  const txns = await client.accounting.listTransactions.query({
    startDate: start,
    endDate: end,
    limit: 100
  });
  if (txns.length === 0) {
    throw new Error("No recent transactions found. Cannot prompt for selection.");
  }
  const choice = await select({
    message,
    choices: txns.map((t) => ({
      name: `${t.id.slice(0, 8)}… — ${t.type} ${formatMoney(t.amount)} (${t.account.name})`,
      value: t.id
    }))
  });
  return choice;
}
