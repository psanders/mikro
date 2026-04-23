/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { Flags } from "@oclif/core";
import { input, password } from "@inquirer/prompts";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import type { AppRouter } from "@mikro/apiserver";
import { BaseCommand } from "../../BaseCommand.js";
import { DEFAULT_API_URL, loadConfig, saveConfig, type Config } from "../../lib/config.js";
import { createClient } from "../../lib/trpc.js";

/**
 * Unauthenticated tRPC client used to call the public `login` mutation.
 * `createClient` assumes a token, so we build a bare client here.
 */
function createAnonymousClient(baseUrl: string) {
  return createTRPCClient<AppRouter>({
    links: [httpBatchLink({ url: `${baseUrl}/trpc` })]
  });
}

export default class Login extends BaseCommand<typeof Login> {
  static override readonly description = "authenticate with the Mikro API";
  static override readonly examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> --phone +18091234567 --password secret",
    "<%= config.bin %> <%= command.id %> --api-url http://api.example.com"
  ];
  static override readonly flags = {
    phone: Flags.string({
      char: "u",
      description: "phone number for authentication (E.164, e.g. +18091234567)",
      required: false,
      aliases: ["username"]
    }),
    password: Flags.string({
      char: "p",
      description: "password for authentication",
      required: false
    }),
    "api-url": Flags.string({
      description: "API server URL",
      required: false
    })
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(Login);

    const existingConfig = loadConfig();
    if (existingConfig) {
      const who = existingConfig.name
        ? `${existingConfig.name} (${existingConfig.phone})`
        : existingConfig.phone;
      this.log(`Already logged in as ${who} to ${existingConfig.apiUrl}`);
      this.log("Use 'mikro auth:logout' to log out first.");
      return;
    }

    let phone: string;
    let passwordValue: string;
    let apiUrl: string;

    if (flags.phone && flags.password) {
      phone = flags.phone;
      passwordValue = flags.password;
      apiUrl = flags["api-url"] || DEFAULT_API_URL;
    } else {
      this.log("Please provide your credentials:");
      phone = await input({
        message: "Phone",
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

    let token: string;
    try {
      const anon = createAnonymousClient(apiUrl);
      const result = await anon.login.mutate({ phone, password: passwordValue });
      token = result.token;
    } catch (error) {
      this.error(`Login failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    let displayName: string | undefined;
    let displayPhone = phone;
    try {
      const authed = createClient(apiUrl, token);
      const me = await authed.whoami.query();
      displayName = me.name ?? undefined;
      displayPhone = me.phone ?? phone;
    } catch (error) {
      this.error(
        `Failed to verify session: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    const config: Config = {
      token,
      apiUrl,
      phone: displayPhone,
      name: displayName
    };

    try {
      saveConfig(config);
      const who = displayName ? `${displayName} (${displayPhone})` : displayPhone;
      this.log(`✓ Successfully logged in as ${who} to ${apiUrl}`);
    } catch (error) {
      this.error(
        `Failed to save credentials: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
