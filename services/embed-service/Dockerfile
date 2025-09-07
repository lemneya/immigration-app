# Multi-stage build for Bmore Embedding Service
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml* ./

# Install pnpm and dependencies
RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
RUN pnpm run build

# Production stage
FROM node:18-alpine AS runner

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 embedservice

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml* ./

# Install pnpm and production dependencies only
RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile --prod

# Copy built application
COPY --from=builder --chown=embedservice:nodejs /app/dist ./dist

# Create directories for models and cache
RUN mkdir -p /app/.cache/huggingface && chown -R embedservice:nodejs /app/.cache
RUN mkdir -p /app/models && chown -R embedservice:nodejs /app/models

# Set environment variables
ENV NODE_ENV=production
ENV TRANSFORMERS_CACHE=/app/.cache/huggingface
ENV HF_HOME=/app/.cache/huggingface

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=60s --retries=3 \
  CMD node -e "http.get('http://localhost:3011/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Switch to non-root user
USER embedservice

# Expose port
EXPOSE 3011

# Start the service
CMD ["node", "dist/server.js"]