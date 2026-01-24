/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */

/**
 * Handles errors from tRPC calls and formats them for CLI output.
 * @param e - The error object
 * @param log - The logging function to use
 */
function errorHandler(e: unknown, log: (message: string) => void): void {
  const error = e as { code?: string; message: string };

  // Handle tRPC errors
  if (error.message) {
    // Try to extract the meaningful part of the error message
    const message = error.message.trim();
    log(message);
    return;
  }

  log("An unknown error occurred");
}

export default errorHandler;
