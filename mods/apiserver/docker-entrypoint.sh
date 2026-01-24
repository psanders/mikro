#!/bin/sh
set -e

# Run database migrations
echo "Running database migrations..."
npm run db:migrate:deploy || {
    echo "Migration failed, attempting to initialize database..."
    npm run db:push || true
}

# Start the server
echo "Starting API server..."
exec "$@"
