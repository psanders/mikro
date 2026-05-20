# Mikro CTL

Command-line interface for Mikro (`mikro`). Part of the [Mikro monorepo](https://github.com/psanders/mikro).

## Authentication

```bash
mikro auth:login
mikro auth:logout
```

## CLI conventions

These rules apply across all commands. When in doubt, run `mikro <command> --help`.

### Primary entity ID — positional

Commands that act on **one** main record take its ID as the **first positional argument**:

```bash
mikro loans:addNote 10001 --content "..."
mikro customers:get <customerId>
mikro payments:reverse <paymentId>
mikro accounting:transactions:get <transactionId>
```

- Omit the ID in a TTY session to get an interactive picker.
- In non-interactive mode (scripts, pipes), the positional argument is **required**.

### Secondary entity IDs — flags

Related records use `--<entity>-id` flags:

```bash
mikro payments:create 10001 --amount 500 --collector-id <uuid>
mikro loans:addNote 10001 --user-id <uuid>
```

### List commands

List commands share:

| Flag               | Short | Description                                    |
| ------------------ | ----- | ---------------------------------------------- |
| `--page-size`      | `-s`  | Max rows (default 100)                         |
| `--offset`         |       | Skip rows for pagination                       |
| `--include-hidden` | `-a`  | Include closed/inactive/disabled/reversed rows |

Legacy aliases still work: `--include-closed`, `--include-inactive`, `--include-disabled`, `--include-reversed`.

Filtered lists keep camelCase subcommands with a positional filter ID:

```bash
mikro loans:listByCollector <collectorId>
mikro payments:listByLoanId 10001
```

### Date ranges

Commands that filter by period use `--start-date` and `--end-date` (`YYYY-MM-DD`). When omitted on list commands, the default is the **last 30 days**. Single-date filters use `--date` (default: today).

### Updates — hybrid shape

Update commands take a positional ID plus optional field flags. Unspecified fields are prompted in a TTY or left unchanged in scripts:

```bash
mikro customers:update <customerId> --name "Jane" --phone "+18091234567"
mikro users:update <userId> --role COLLECTOR
mikro accounting:accounts:update <accountId> --is-active false
```

### Mutations — confirmation

Creating, updating, or reversing records prompts for confirmation. Pass `--yes` / `-y` to skip (required in non-TTY unless all inputs are provided via flags/args).

### Command renames / splits

| Old                                        | New                                             |
| ------------------------------------------ | ----------------------------------------------- |
| `accounting:transactions:show`             | `accounting:transactions:get`                   |
| `payments:generateReceipt --manual`        | `payments:generateManualReceipt`                |
| `collections:run --loan-id N`              | `collections:runSingle N`                       |
| `chat:history --customer-id` / `--user-id` | `chat:historyByCustomer` / `chat:historyByUser` |
| `reports:customers --collector`            | `reports:customers --collector-id`              |

## Build

```bash
pnpm --filter @mikro/ctl build
pnpm --filter @mikro/ctl typecheck
```
