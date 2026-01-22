# @mikro/ctl

Mikro CLI tool for generating receipts and managing assets.

## Installation

This package is part of the Mikro monorepo. Install dependencies from the root:

```bash
npm install
```

## Usage

From the root of the monorepo:

```bash
npx mikro generate-receipt loans/10001.json
```

Or install globally:

```bash
npm install -g @mikro/ctl
mikro generate-receipt loans/10001.json
```

## Commands

### `generate-receipt`

Generate a payment receipt as an image (PNG and SVG).

**Usage:**
```bash
mikro generate-receipt <loan-file> [options]
```

**Arguments:**
- `loan-file` (required): Path to the loan JSON file

**Options:**
- `--output, -o`: Output directory for generated files (default: `./output`)
- `--keys-dir`: Directory containing private.pem key file (default: `./keys`)
- `--assets-dir`: Directory containing background.png asset (default: `./assets`)

**Examples:**
```bash
# Basic usage
mikro generate-receipt loans/10001.json

# Custom output directory
mikro generate-receipt loans/10001.json --output ./receipts

# Custom keys and assets directories
mikro generate-receipt loans/10001.json --keys-dir ./keys --assets-dir ./assets
```

## Development

This CLI is built with [oclif](https://oclif.io/).
