# Production image - expects pre-built artifacts from CI
FROM node:22-alpine

# Install runtime dependencies for native modules
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    && rm -rf /var/cache/apk/*

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Set working directory
WORKDIR /app

# Copy root package files
COPY package.json package-lock.json ./

# Copy workspace package files and pre-built dist directories
COPY mods/common/package.json ./mods/common/
COPY mods/common/dist ./mods/common/dist
COPY mods/agents/package.json ./mods/agents/
COPY mods/agents/dist ./mods/agents/dist
COPY mods/apiserver/package.json ./mods/apiserver/
COPY mods/apiserver/dist ./mods/apiserver/dist
COPY mods/apiserver/prisma ./mods/apiserver/prisma
COPY mods/apiserver/prisma.config.ts ./mods/apiserver/
COPY mods/apiserver/src/generated ./mods/apiserver/src/generated
COPY mods/apiserver/assets ./mods/apiserver/assets

# Copy entrypoint script and make it executable
COPY mods/apiserver/docker-entrypoint.sh ./mods/apiserver/docker-entrypoint.sh
RUN chmod +x ./mods/apiserver/docker-entrypoint.sh

# Install production dependencies and rebuild native modules
RUN npm ci --omit=dev --ignore-scripts && \
    npm rebuild better-sqlite3

# `npm ci` from a lockfile generated on another platform does not reliably
# install @resvg/resvg-js's musl native binary, so the server crashes at startup
# with "Cannot find module '@resvg/resvg-js-linux-x64-musl'". Install the
# arch-matched binary explicitly (TARGETARCH is set by buildx; fall back to
# Node's process.arch for a plain `docker build`). Keep the version in lockstep
# with @resvg/resvg-js.
ARG TARGETARCH
RUN ARCH="${TARGETARCH:-$(node -e 'process.stdout.write(process.arch)')}" && \
    case "$ARCH" in \
      amd64 | x64) RESVG_BINARY="@resvg/resvg-js-linux-x64-musl" ;; \
      arm64) RESVG_BINARY="@resvg/resvg-js-linux-arm64-musl" ;; \
      *) echo "Unsupported architecture for resvg: $ARCH" && exit 1 ;; \
    esac && \
    npm install --no-save --include=optional "${RESVG_BINARY}@2.6.2"

# Install Prisma CLI globally for migrations
RUN npm install -g prisma@^7.3.0 && \
    npm cache clean --force

# Create directories for data and receipt images
RUN mkdir -p /app/data /app/receipts && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Set working directory to apiserver
WORKDIR /app/mods/apiserver

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Use entrypoint script
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "dist/index.js"]
