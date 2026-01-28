/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { Flags } from "@oclif/core";
import { input, password } from "@inquirer/prompts";
import { BaseCommand } from "../../BaseCommand.js";
import { DEFAULT_API_URL, loadConfig, saveConfig, type Config } from "../../lib/config.js";
import { createClient } from "../../lib/trpc.js";

export default class Login extends BaseCommand<typeof Login> {
  static override readonly description = "authenticate with the Mikro API";
  static override readonly examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> --username admin --password secret",
    "<%= config.bin %> <%= command.id %> --api-url http://api.example.com"
  ];
  static override readonly flags = {
    username: Flags.string({
      char: "u",
      description: "username for authentication",
      required: false
    }),
    password: Flags.string({
      char: "p",
      description: "password for authentication",
      required: false
    }),
    "api-url": Flags.string({
      description: "API server URL",
      required: false
    }),
    "skip-verify": Flags.boolean({
      description: "skip connection verification before saving",
      default: false
    })
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(Login);

    // Check if already logged in
    const existingConfig = loadConfig();
    if (existingConfig) {
      this.log(`Already logged in as ${existingConfig.username} to ${existingConfig.apiUrl}`);
      this.log("Use 'mikro auth:logout' to log out first.");
      return;
    }

    let username: string;
    let passwordValue: string;
    let apiUrl: string;

    // Interactive mode or flag mode
    if (flags.username && flags.password) {
      // Flag mode
      username = flags.username;
      passwordValue = flags.password;
      apiUrl = flags["api-url"] || DEFAULT_API_URL;
    } else {
      // Interactive mode
      this.log("Please provide your credentials:");
      username = await input({
        message: "Username",
        required: true
      });
      passwordValue = await password({
        message: "Password",
        mask: true
      });
      apiUrl =
        flags["api-url"] ||
        (await input({
          message: "API URL",
          default: DEFAULT_API_URL,
          required: true
        }));
    }

    // Verify connection unless --skip-verify is set
    if (!flags["skip-verify"]) {
      this.log("Verifying connection...");
      try {
        const credentials = `${username}:${passwordValue}`;
        const testClient = createClient(apiUrl, credentials);
        // Try a simple query to verify credentials
        await testClient.listUsers.query({ showDisabled: false, limit: 1 });
        this.log("✓ Connection verified");
      } catch (error) {
        this.error(
          `Failed to verify connection: ${error instanceof Error ? error.message : String(error)}\n` +
            "Use --skip-verify to save credentials without verification."
        );
      }
    }

    // Save config
    const config: Config = {
      username,
      password: passwordValue,
      apiUrl
    };

    try {
      saveConfig(config);
      this.log(`✓ Successfully logged in as ${username} to ${apiUrl}`);
    } catch (error) {
      this.error(
        `Failed to save credentials: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
