/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "fs";
import { dirname } from "path";
import { homedir } from "os";

export interface Config {
  username: string;
  password: string;
  apiUrl: string;
}

/**
 * Default API URL, can be overridden via MIKRO_API_URL environment variable.
 */
export const DEFAULT_API_URL = process.env.MIKRO_API_URL || "http://localhost:4000";

/**
 * Returns the OS-agnostic path to the config file.
 * @returns Path to ~/.mikro/config.json
 */
export function getConfigPath(): string {
  return `${homedir()}/.mikro/config.json`;
}

/**
 * Loads the config file from disk.
 * @returns Config object or null if file doesn't exist
 */
export function loadConfig(): Config | null {
  const configPath = getConfigPath();

  if (!existsSync(configPath)) {
    return null;
  }

  try {
    const content = readFileSync(configPath, "utf-8");
    return JSON.parse(content) as Config;
  } catch (error) {
    throw new Error(
      `Failed to read config file: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Saves the config to disk, creating the directory if needed.
 * @param config - The config object to save
 */
export function saveConfig(config: Config): void {
  const configPath = getConfigPath();
  const configDir = dirname(configPath);

  try {
    // Create directory if it doesn't exist
    if (!existsSync(configDir)) {
      mkdirSync(configDir, { recursive: true });
    }

    // Write config file
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
