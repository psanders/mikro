# Mikro Créditos Tooling

A monorepo for generating payment receipts and other tools for the Mikro Créditos platform.

## Features

- 🎨 Custom background image support
- 🔐 RSA-2048 signed JWT for verification
- 📱 QR code containing signed payment data
- 📝 Generates SVG and PNG outputs
- 🖼️ High-resolution (2x) PNG output
- 🏗️ Monorepo structure with Lerna and NPM workspaces
- 🛠️ CLI tool built with oclif

## Project Structure

This is a monorepo managed with Lerna and NPM workspaces:

```
mikro/
├── modules/
│   ├── common/          # Shared utilities and common code
│   │   ├── src/
│   │   │   ├── jwt.js           # JWT token creation
│   │   │   ├── qrcode.js        # QR code generation
│   │   │   ├── fonts.js         # Font loading
│   │   │   ├── files.js         # File I/O utilities
│   │   │   ├── receipt-layout.js # Receipt layout creation
│   │   │   ├── keygen.js        # Key generation
│   │   │   └── index.js         # Main exports
│   │   └── package.json
│   └── ctl/             # CLI tool (oclif)
│       ├── src/
│       │   └── commands/
│       │       └── generate-receipt.js  # Generate receipt command
│       ├── bin/
│       │   └── run.js           # CLI entry point
│       └── package.json
├── assets/
│   └── background.png    # Background image (832x1248)
├── keys/
│   ├── private.pem       # RSA private key (keep secure!)
│   └── public.pem        # RSA public key (for verification)
├── loans/
│   └── *.json            # Loan data files
├── output/
│   ├── receipt.png       # Generated receipt image
│   ├── receipt.svg       # Generated receipt SVG
│   └── token.jwt         # Signed JWT token
├── lerna.json            # Lerna configuration
└── package.json          # Root package.json with workspaces
```

## Quick Start

### Installation

```bash
# Install all dependencies (including workspace dependencies)
npm install
```

### Installing the CLI Tool

You can use the CLI tool in several ways:

**Option 1: Use npx (no installation needed)**
```bash
npx mikro generate-receipt loans/10001.json
```

**Option 2: Link locally for development (recommended)**
```bash
cd modules/ctl
npm link
```

This creates a global symlink, so you can use `mikro` from anywhere:
```bash
mikro generate-receipt loans/10001.json
```

**Option 3: Install globally from the monorepo**
```bash
npm install -g ./modules/ctl
```

**Option 4: Publish to npm (for distribution)**
If you want to publish the CLI to npm for others to use:
```bash
cd modules/ctl
npm publish
```

Then others can install it with:
```bash
npm install -g @mikro/ctl
```

### Generate Keys

First, generate an RSA key pair for signing receipts:

```bash
# Using the CLI (once implemented)
npx mikro generate-key

# Or using Node directly (temporary until key command is added)
node -e "import('@mikro/common').then(m => { const { generateKeys } = m; const { dirname } = await import('path'); const { fileURLToPath } = await import('url'); const keysDir = dirname(fileURLToPath(import.meta.url)) + '/../../keys'; generateKeys(keysDir); console.log('Keys generated!'); })"
```

### Generate Receipt

```bash
# Using the CLI
npx mikro generate-receipt loans/10001.json

# With custom output directory
npx mikro generate-receipt loans/10001.json --output ./receipts

# With custom keys and assets directories
npx mikro generate-receipt loans/10001.json --keys-dir ./keys --assets-dir ./assets
```

## Loan Data Format

Loan data files should be JSON files with the following structure:

```json
{
  "loanNumber": "123456",
  "firstName": "John",
  "lastName": "Doe",
  "date": "24/04/2024",
  "amountPaid": "RD$ 650",
  "pendingPayments": 9,
  "paymentNumber": "P1",
  "agentName": "María García"
}
```

## Packages

### @mikro/common

Shared utilities and common code used across the monorepo. See [modules/common/README.md](./modules/common/README.md) for details.

### @mikro/ctl

CLI tool for generating receipts and managing assets. See [modules/ctl/README.md](./modules/ctl/README.md) for details.

## Verification

The QR code contains a signed JWT that can be verified using the public key:

```javascript
import jwt from 'jsonwebtoken';
import { readFileSync } from 'fs';

const token = '<scanned QR code content>';
const publicKey = readFileSync('keys/public.pem', 'utf-8');

const decoded = jwt.verify(token, publicKey, { algorithms: ['RS256'] });
console.log(decoded);
```

## Security

- The private key (`keys/private.pem`) should be kept secure
- Never commit the `keys/` directory to version control
- The public key can be distributed for verification
- JWTs expire after 1 year by default

## Development

### Monorepo Commands

```bash
# Clean all node_modules
npm run clean

# Build all packages
npm run build

# Run tests in all packages
npm run test
```

### Adding a New Package

1. Create a new directory under `modules/`
2. Add a `package.json` with the package name following `@mikro/<name>` convention
3. Run `npm install` from the root to install dependencies and link workspaces

## License

MIT
