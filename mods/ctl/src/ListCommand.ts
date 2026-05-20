/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Base class for list-style commands. Adds page-size to the shared flags.
 * Use this instead of BaseCommand when the command lists paginated items.
 */
import { Command, Flags as OclifFlags, Interfaces } from "@oclif/core";
import { BaseCommand } from "./BaseCommand.js";

export abstract class ListCommand<T extends typeof Command> extends BaseCommand<T> {
  static override baseFlags = {
    ...BaseCommand.baseFlags,
    "page-size": OclifFlags.integer({
      char: "s",
      description: "The number of items to show",
      default: 100
    }),
    offset: OclifFlags.integer({
      description: "Skip this many rows (for pagination)",
      default: 0,
      min: 0
    }),
    "include-hidden": OclifFlags.boolean({
      char: "a",
      description:
        "Include hidden rows (closed loans, inactive customers, disabled users, reversed payments, etc.)",
      default: false,
      aliases: ["include-closed", "include-inactive", "include-disabled", "include-reversed"]
    })
  };
}

export type ListFlags<T extends typeof Command> = Interfaces.InferredFlags<
  (typeof ListCommand)["baseFlags"] & T["flags"]
>;
