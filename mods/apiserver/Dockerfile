# Production image - expects pre-built artifacts from CI
FROM node:20-alpine

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

# Install Prisma CLI globally for migrations
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
