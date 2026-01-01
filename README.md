# Mikro Receipt Generator

Generate beautiful, cryptographically signed payment receipts as images using Satori.

## Features

- 🎨 Custom background image support
- 🔐 RSA-2048 signed JWT for verification
- 📱 QR code containing signed payment data
- 📝 Generates SVG and PNG outputs
- 🖼️ High-resolution (2x) PNG output

## Quick Start

```bash
# Install dependencies
npm install

# Generate RSA key pair (first time only)
npm run generate:key

# Edit loan.json with payment data
# Then generate the receipt
npm run generate
```

## Project Structure

```
mikro/
├── assets/
│   └── background.png    # Background image (832x1248)
├── keys/
│   ├── private.pem              # RSA private key (keep secure!)
│   └── public.pem               # RSA public key (for verification)
├── output/
│   ├── receipt.png              # Generated receipt image
│   ├── receipt.svg              # Generated receipt SVG
│   └── token.jwt                # Signed JWT token
├── src/
│   ├── generate.js              # Main receipt generator
│   └── generate-key.js          # Key generation script
├── loan.json                    # Payment data input
└── package.json
```

## Loan Data Format

Edit `loan.json` with the payment information:

```json
{
  "loanNumber": "123456",
  "firstName": "John",
  "lastName": "Doe",
  "date": "24/04/2024",
  "amountPaid": "RD$ 650",
  "pendingBalance": "RD$ 2,350",
  "paymentNumber": "P1",
  "agentName": "María García"
}
```

## Verification

The QR code contains a signed JWT that can be verified using the public key:

```javascript
const jwt = require('jsonwebtoken');
const fs = require('fs');

const token = '<scanned QR code content>';
const publicKey = fs.readFileSync('keys/public.pem', 'utf-8');

const decoded = jwt.verify(token, publicKey, { algorithms: ['RS256'] });
console.log(decoded);
```

## Security

- The private key (`keys/private.pem`) should be kept secure
- Never commit the `keys/` directory to version control
- The public key can be distributed for verification
- JWTs expire after 1 year by default

## Commands

| Command | Description |
|---------|-------------|
| `npm run generate:key` | Generate RSA key pair |
| `npm run generate` | Generate receipt from loan.json |
| `npm run dev` | Watch mode for development |
# mikro
