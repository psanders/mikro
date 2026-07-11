/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { confirm } from "@inquirer/prompts";
import { Command, Interfaces } from "@oclif/core";
import { createClient } from "./lib/trpc.js";
import { loadConfig } from "./lib/config.js";
import { localDateString, parseDateOnly, endOfDayLocal } from "./lib/dates.js";

export type Args<T extends typeof Command> = Interfaces.InferredArgs<T["args"]>;

/**
 * Validates date format (YYYY-MM-DD)
 */
export function validateDate(value: string): string {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(value)) {
    throw new Error(`Invalid date format: ${value}. Expected YYYY-MM-DD`);
  }
  const date = new Date(value);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date: ${value}`);
  }
  return value;
}

export type ParsedDateRange = {
  startDate: Date;
  endDate: Date;
  startDateStr: string;
  endDateStr: string;
};

/**
 * Parse --start-date / --end-date with optional defaults (last N days ending today).
 * Dates are handled in local time throughout: an explicit --end-date covers the
 * whole local day (inclusive), and "today" means the local calendar date.
 */
export function parseDateRange(
  startDateFlag: string | undefined,
  endDateFlag: string | undefined,
  options?: { defaultDays?: number }
): ParsedDateRange {
  if (startDateFlag) validateDate(startDateFlag);
  if (endDateFlag) validateDate(endDateFlag);

  const end = endDateFlag ? endOfDayLocal(endDateFlag) : new Date();
  let start: Date;
  if (startDateFlag) {
    start = parseDateOnly(startDateFlag);
  } else if (options?.defaultDays !== undefined) {
    start = new Date(end);
    start.setDate(start.getDate() - options.defaultDays);
  } else {
    start = new Date(end.getFullYear(), end.getMonth(), 1, 0, 0, 0, 0);
  }

  const startDateStr = localDateString(start);
  const endDateStr = localDateString(end);

  return {
    startDate: start,
    endDate: end,
    startDateStr,
    endDateStr
  };
}

/**
 * Parse a single --date flag (YYYY-MM-DD). Defaults to today (local time).
 */
export function parseSingleDate(dateFlag: string | undefined): Date {
  const str = dateFlag ?? localDateString();
  validateDate(str);
  const d = parseDateOnly(str);
  d.setHours(12, 0, 0, 0);
  return d;
}

export abstract class BaseCommand<T extends typeof Command> extends Command {
  protected flags!: Flags<T>;
  protected args!: Args<T>;

  static baseFlags = {};

  /**
   * Merges baseFlags from the command's class hierarchy (BaseCommand, ListCommand, etc.)
   * so that list commands get page-size and other list-specific flags.
   */
  protected static getMergedBaseFlags(ctor: typeof Command): Interfaces.FlagInput {
    const chain: Interfaces.FlagInput[] = [];
    let c: typeof Command | null = ctor;
    while (c && c !== Command) {
      const base = (c as { baseFlags?: Interfaces.FlagInput }).baseFlags;
      if (base) chain.unshift(base);
      c = Object.getPrototypeOf(c);
    }
    return Object.assign({}, ...chain);
  }

  public async init(): Promise<void> {
    await super.init();
    const { args, flags } = await this.parse({
      flags: this.ctor.flags,
      baseFlags: (this.ctor as typeof BaseCommand).getMergedBaseFlags(this.ctor),
      enableJsonFlag: this.ctor.enableJsonFlag,
      args: this.ctor.args,
      strict: this.ctor.strict
    });
    this.flags = flags as Flags<T>;
    this.args = args as Args<T>;
  }

  protected createClient() {
    const config = loadConfig();

    if (!config) {
      this.error('Not logged in. Run "mikro auth:login" to authenticate.');
    }

    return createClient(config.apiUrl, config.token);
  }

  /**
   * Prompt for confirmation unless --yes was passed (MutationCommand).
   * Returns false if the user declined (already logged "Aborted!").
   */
  protected async confirmOrAbort(
    message: string,
    options?: { default?: boolean }
  ): Promise<boolean> {
    const yes = (this.flags as { yes?: boolean }).yes;
    if (yes) {
      return true;
    }
    if (!process.stdout.isTTY) {
      this.error("Confirmation required. Pass --yes to proceed in non-interactive mode.");
    }
    const ready = await confirm({ message, default: options?.default ?? false });
    if (!ready) {
      this.log("Aborted!");
      return false;
    }
    return true;
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
