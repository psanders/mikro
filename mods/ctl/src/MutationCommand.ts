/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Base class for mutating commands. Adds --yes to skip confirmation prompts.
 */
import { Command, Flags as OclifFlags, Interfaces } from "@oclif/core";
import { BaseCommand } from "./BaseCommand.js";

export abstract class MutationCommand<T extends typeof Command> extends BaseCommand<T> {
  static override baseFlags = {
    ...BaseCommand.baseFlags,
    yes: OclifFlags.boolean({
      char: "y",
      description: "Skip confirmation prompt",
      default: false
    })
  };
}

export type MutationFlags<T extends typeof Command> = Interfaces.InferredFlags<
  (typeof MutationCommand)["baseFlags"] & T["flags"]
>;
