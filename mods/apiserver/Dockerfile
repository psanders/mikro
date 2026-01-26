# Stage 1: Builder
FROM node:20-alpine AS builder

# Install build dependencies for native modules (better-sqlite3)
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git

# Set working directory
WORKDIR /app

# Copy root package files
COPY package.json package-lock.json ./
COPY lerna.json ./
COPY tsconfig.json ./

# Copy workspace package files
COPY mods/common/package.json ./mods/common/
COPY mods/agents/package.json ./mods/agents/
COPY mods/apiserver/package.json ./mods/apiserver/

# Install all dependencies (including dev dependencies for build)
RUN npm ci

# Copy source files for workspace packages
COPY mods/common/ ./mods/common/
COPY mods/agents/ ./mods/agents/
COPY mods/apiserver/ ./mods/apiserver/

# Build all workspace packages in a single layer (ensures symlinks work correctly in buildx)
# Order: common -> agents -> apiserver (respecting dependencies)
RUN npm run build -w @mikro/common && \
    npm run build -w @mikro/agents && \
    npm run db:generate -w @mikro/apiserver && \
    npm run build -w @mikro/apiserver

# Stage 2: Production
FROM node:20-alpine AS production

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

# Copy built workspace packages
COPY --from=builder /app/mods/common/dist ./mods/common/dist
COPY --from=builder /app/mods/common/package.json ./mods/common/
COPY --from=builder /app/mods/agents/dist ./mods/agents/dist
COPY --from=builder /app/mods/agents/package.json ./mods/agents/
COPY --from=builder /app/mods/apiserver/dist ./mods/apiserver/dist
COPY --from=builder /app/mods/apiserver/package.json ./mods/apiserver/
COPY --from=builder /app/mods/apiserver/prisma ./mods/apiserver/prisma
COPY --from=builder /app/mods/apiserver/prisma.config.ts ./mods/apiserver/
COPY --from=builder /app/mods/apiserver/src/generated ./mods/apiserver/src/generated
COPY --from=builder /app/mods/apiserver/assets ./mods/apiserver/assets

# Copy entrypoint script and make it executable
COPY --from=builder /app/mods/apiserver/docker-entrypoint.sh ./mods/apiserver/docker-entrypoint.sh
RUN chmod +x ./mods/apiserver/docker-entrypoint.sh

# Install only production dependencies
# Use --ignore-scripts to skip husky prepare script (not needed in production containers)
RUN npm ci --omit=dev --ignore-scripts

# Install Prisma CLI globally for migrations (needed for db:migrate:deploy)
RUN npm install -g prisma@^7.3.0 && \
    npm cache clean --force

# Create directories for data and images
RUN mkdir -p /app/data /app/images && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Set working directory to apiserver
WORKDIR /app/mods/apiserver

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Use entrypoint script
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "dist/index.js"]
