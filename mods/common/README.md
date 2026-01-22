# @mikro/common

Common utilities and shared code for the Mikro monorepo.

## Features

- JWT token creation and signing
- QR code generation
- Font loading utilities
- File I/O utilities
- Receipt layout creation
- Key generation utilities

## Usage

```javascript
import {
  loadLoanData,
  loadPrivateKey,
  createSignedToken,
  generateQRCode,
  loadFonts,
  loadBackgroundImage,
  createReceiptLayout,
  generateKeys,
  RECEIPT_WIDTH,
  RECEIPT_HEIGHT,
} from '@mikro/common';
```

## API

### JWT Utilities

- `loadPrivateKey(keysDir)`: Load private key from directory
- `createSignedToken(loanData, privateKey)`: Create signed JWT token

### QR Code Utilities

- `generateQRCode(data)`: Generate QR code as data URL

### Font Utilities

- `loadFonts()`: Load Inter font family for Satori

### File Utilities

- `loadLoanData(loanPath)`: Load and parse loan JSON file
- `loadBackgroundImage(assetsDir)`: Load background image as base64 data URL

### Receipt Layout

- `createReceiptLayout(data, qrCodeDataUrl, backgroundImage)`: Create receipt layout object
- `RECEIPT_WIDTH`: Receipt width constant (1024)
- `RECEIPT_HEIGHT`: Receipt height constant (1536)

### Key Generation

- `generateKeys(keysDir)`: Generate RSA key pair
