/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { Command, Interfaces } from "@oclif/core";
import { createClient } from "./lib/trpc.js";

export type Args<T extends typeof Command> = Interfaces.InferredArgs<T["args"]>;

export abstract class BaseCommand<T extends typeof Command> extends Command {
  protected flags!: Flags<T>;
  protected args!: Args<T>;

  public async init(): Promise<void> {
    await super.init();
    const { args, flags } = await this.parse({
      flags: this.ctor.flags,
      baseFlags: (super.ctor as typeof BaseCommand).baseFlags,
      enableJsonFlag: this.ctor.enableJsonFlag,
      args: this.ctor.args,
      strict: this.ctor.strict
    });
    this.flags = flags as Flags<T>;
    this.args = args as Args<T>;
  }

  protected createClient() {
    const apiUrl = process.env.MIKRO_API_URL || "http://localhost:3000";
    const credentials = process.env.SYSTEM_BASICAUTH;

    if (!credentials) {
      this.error("SYSTEM_BASICAUTH environment variable is required");
    }

    return createClient(apiUrl, credentials);
  }

  protected async catch(err: Error & { exitCode?: number }) {
    return super.catch(err);
  }

  protected async finally(_: Error | undefined) {
    return super.finally(_);
  }
}

export type Flags<T extends typeof Command> = Interfaces.InferredFlags<
  (typeof BaseCommand)["baseFlags"] & T["flags"]
>;
