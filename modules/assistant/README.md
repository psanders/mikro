# @mikro/assistant

WhatsApp AI Assistant for Mikro Créditos using OpenAI's GPT-4o with vision support.

## Features

- 🤖 AI-powered WhatsApp assistant using OpenAI GPT-4o
- 👁️ Vision support for processing document images (PNG)
- 🔧 Tool calling support (createMember tool)
- 📝 Member management with JSON file storage
- 📊 Google Sheets integration for member data
- 🔄 Automatic member detection and workflow triggering
- 📊 Comprehensive logging
- 🚀 PM2 process management

## Overview

The assistant handles incoming WhatsApp messages and:
- **New members**: Triggers the agent workflow to collect required information and create an account
- **Existing members**: Ignores the request and allows human agents to handle

## Setup

### Prerequisites

- Node.js 18+ 
- PM2 installed globally: `npm install -g pm2`
- OpenAI API key
- WhatsApp Business API credentials (for production)

### Installation

```bash
# From project root
npm install

# The module will be installed as part of the monorepo
```

### Configuration

1. **Set up environment variables**:

Copy the example environment file and fill in your values:

```bash
cd modules/assistant
cp .env.example .env
```

Then edit `.env` and add your credentials:

```bash
# OpenAI Configuration
OPENAI_API_KEY=your-openai-api-key-here

# WhatsApp Business API Configuration
WHATSAPP_PHONE_NUMBER_ID=your-phone-number-id-here
WHATSAPP_ACCESS_TOKEN=your-access-token-here
WHATSAPP_VERIFY_TOKEN=your-webhook-verify-token-here

# Server Configuration
PORT=3000
```

> **Note**: The `.env` file is already in `.gitignore` and will not be committed to version control.

2. **Configure system prompt**:

Edit `modules/assistant/agent.md` to customize the system prompt and agent behavior. This file contains the instructions for the AI agent in markdown format.

3. **WhatsApp Business API Setup**:

For production, you'll need to:
- Set up a WhatsApp Business Account
- Configure webhook URL: `https://your-domain.com/webhook`
- Set the verify token to match `WHATSAPP_VERIFY_TOKEN`

## Usage

### Development

```bash
# From project root
npm run start:assistant

# Or from module directory
cd modules/assistant
npm run dev
```

### Production with PM2

```bash
cd modules/assistant

# Start with PM2
pm2 start ecosystem.config.js

# View logs
pm2 logs mikro-assistant

# Stop
pm2 stop mikro-assistant

# Restart
pm2 restart mikro-assistant

# View status
pm2 status
```

## API Endpoints

### Health Check
```
GET /health
```

### Webhook Verification (WhatsApp)
```
GET /webhook?hub.mode=subscribe&hub.verify_token=TOKEN&hub.challenge=CHALLENGE
```

### Webhook (WhatsApp Messages)
```
POST /webhook
```

## Member Management

Members are stored in `modules/assistant/members.json` with the following structure:

```json
{
  "1234567890": {
    "phone": "1234567890",
    "name": "John Doe",
    "idNumber": "001-1234567-8",
    "address": "123 Main St",
    "currentSalary": "50000",
    "currentJobPosition": "Software Developer",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

## Tool Calling

### createMember

Creates a new member account after collecting all required information. The member data is saved to both `members.json` and optionally to a Google Sheet if configured.

**Parameters:**
- `phone` (string, required): Member phone number
- `name` (string, required): Member full name
- `idNumber` (string, required): Member ID number (cédula)
- `address` (string, required): Member address
- `currentSalary` (string, required): Member current salary
- `currentJobPosition` (string, required): Member current job position

**Returns:**
- Success status and member object

## Logging

Logs are written to `modules/assistant/logs/assistant-YYYY-MM-DD.log` with JSON format:

```json
{
  "timestamp": "2024-01-01T00:00:00.000Z",
  "level": "INFO",
  "message": "Message received",
  "data": { "phone": "1234567890" }
}
```

## Architecture

```
modules/assistant/
├── src/
│   ├── index.js          # Main server entry point
│   ├── config.js         # Configuration loading
│   ├── members.js        # Member management (JSON file + Google Sheets)
│   ├── openai.js         # OpenAI integration
│   ├── tools.js          # Tool definitions and execution
│   ├── webhook.js        # WhatsApp webhook handler
│   └── logger.js         # Logging utilities
├── agent.md              # System prompt configuration (markdown)
├── ecosystem.config.js   # PM2 configuration
├── members.json          # Member storage (generated)
└── logs/                 # Log files (generated)
```

## Development Notes

- The WhatsApp message sending is currently a placeholder. You'll need to implement the actual WhatsApp Business API integration.
- Image handling for documents needs to be completed - currently uses placeholder URLs.
- The module uses `@mikro/common` for shared utilities.

## Environment Variables

All environment variables are loaded from a `.env` file in the `modules/assistant/` directory. Copy `.env.example` to `.env` and fill in your values.

### Required Variables

- `OPENAI_API_KEY`: Your OpenAI API key.
- `WHATSAPP_PHONE_NUMBER_ID`: Your WhatsApp Business Phone Number ID from Meta.
- `WHATSAPP_ACCESS_TOKEN`: Your WhatsApp Business API access token from Meta.

### Optional Variables

- `PORT`: Server port (default: 3000).
- `WHATSAPP_VERIFY_TOKEN`: Webhook verification token (default: 'mikro_webhook_token').
- `NODE_ENV`: Node environment (e.g., 'production', 'development').

### Google Sheets Integration (Optional)

To enable Google Sheets integration for member data:

- `GOOGLE_SHEETS_SPREADSHEET_ID`: The ID of your Google Spreadsheet (found in the URL).
- `GOOGLE_SHEETS_SHEET_NAME`: The name of the sheet tab to update (default: 'Sheet1').
- `GOOGLE_SHEETS_CREDENTIALS`: JSON string containing Google service account credentials, OR
- `GOOGLE_SHEETS_CREDENTIALS_PATH`: Path to a JSON file containing Google service account credentials.

**Note**: If `GOOGLE_SHEETS_SPREADSHEET_ID` is not set, Google Sheets integration will be disabled and members will only be saved to `members.json`.

**Setting up Google Sheets credentials:**

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google Sheets API
4. Create a Service Account and download the JSON key file
5. Share your Google Sheet with the service account email (found in the credentials JSON)
6. Set either `GOOGLE_SHEETS_CREDENTIALS` (JSON string) or `GOOGLE_SHEETS_CREDENTIALS_PATH` (path to JSON file)

### Getting WhatsApp Credentials

1. Go to [Meta for Developers](https://developers.facebook.com/)
2. Select your app and go to WhatsApp > API Setup
3. Copy the **Phone Number ID** and **Access Token**
4. Add them to your `.env` file

### Example .env File

See `.env.example` for a template with all required variables.

## License

MIT
