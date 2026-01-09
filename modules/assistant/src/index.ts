// Load environment variables from .env file first
import 'dotenv/config';

import express, { Request, Response, NextFunction } from 'express';
import webhookRouter from './webhook.js';
import { getPort } from './config.js';
import { logger } from './logger.js';

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Webhook routes
app.use('/', webhookRouter);

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const port = getPort();

app.listen(port, () => {
  logger.info(`Mikro Assistant server started on port ${port}`);
  logger.info(`Webhook URL: http://localhost:${port}/webhook`);
  logger.info(`Health check: http://localhost:${port}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});
