/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "fs";
import { dirname } from "path";
import { homedir } from "os";

export interface Config {
  /** Bearer JWT issued by the API's login mutation. */
  token: string;
  /** API server URL. */
  apiUrl: string;
  /** Phone number of the logged-in user (display only). */
  phone: string;
  /** Display name of the logged-in user (display only). */
  name?: string;
}

/**
 * Default API URL.
 */
export const DEFAULT_API_URL = "http://localhost:4000";

/**
 * Returns the OS-agnostic path to the config file.
 * @returns Path to ~/.mikro/config.json
 */
export function getConfigPath(): string {
  return `${homedir()}/.mikro/config.json`;
}

/**
 * Loads the config file from disk.
 * @returns Config object or null if file doesn't exist or is from a previous
 *   (username/password) format that is no longer supported.
 */
export function loadConfig(): Config | null {
  const configPath = getConfigPath();

  if (!existsSync(configPath)) {
    return null;
  }

  let parsed: unknown;
  try {
    const content = readFileSync(configPath, "utf-8");
    parsed = JSON.parse(content);
  } catch (error) {
    throw new Error(
      `Failed to read config file: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  if (
    !parsed ||
    typeof parsed !== "object" ||
    typeof (parsed as { token?: unknown }).token !== "string" ||
    typeof (parsed as { apiUrl?: unknown }).apiUrl !== "string"
  ) {
    // Legacy username/password config - treat as not logged in so the user
    // is prompted to run `mikro auth:login` again.
    return null;
  }

  const c = parsed as Record<string, unknown>;
  return {
    token: c.token as string,
    apiUrl: c.apiUrl as string,
    phone: typeof c.phone === "string" ? c.phone : "",
    name: typeof c.name === "string" ? c.name : undefined
  };
}

/**
 * Saves the config to disk, creating the directory if needed.
 * @param config - The config object to save
 */
export function saveConfig(config: Config): void {
  const configPath = getConfigPath();
  const configDir = dirname(configPath);

  try {
    if (!existsSync(configDir)) {
      mkdirSync(configDir, { recursive: true });
    }

    writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
  } catch (error) {
    throw new Error(
      `Failed to save config file: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Deletes the config file.
 */
export function deleteConfig(): void {
  const configPath = getConfigPath();

  if (existsSync(configPath)) {
    try {
      unlinkSync(configPath);
    } catch (error) {
      throw new Error(
        `Failed to delete config file: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

/**
 * Checks if the config file exists.
 * @returns true if config file exists, false otherwise
 */
export function configExists(): boolean {
  return existsSync(getConfigPath());
}
