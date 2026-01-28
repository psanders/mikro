/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { BaseCommand } from "../../BaseCommand.js";
import { configExists, deleteConfig, loadConfig } from "../../lib/config.js";

export default class Logout extends BaseCommand<typeof Logout> {
  static override readonly description = "log out from the Mikro API";
  static override readonly examples = ["<%= config.bin %> <%= command.id %>"];

  public async run(): Promise<void> {
    if (!configExists()) {
      this.log("Not logged in.");
      return;
    }

    const config = loadConfig();
    if (config) {
      this.log(`Logging out ${config.username} from ${config.apiUrl}...`);
    }

    try {
      deleteConfig();
      this.log("✓ Successfully logged out");
    } catch (error) {
      this.error(`Failed to log out: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
