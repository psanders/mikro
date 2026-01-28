/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { input, password, select, confirm, number } from "@inquirer/prompts";

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
 * Helper to prompt for confirmation if missing
 */
export async function promptConfirmIfMissing(
  value: boolean | undefined,
  message: string,
  flagName: string,
  options?: { default?: boolean }
): Promise<boolean> {
  if (value !== undefined) {
    return value;
  }

  if (!process.stdout.isTTY) {
    // In non-interactive mode, default to false for safety
    return false;
  }

  return confirm({ message, default: options?.default ?? false });
}
