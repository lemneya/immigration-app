# Multi-stage build for Mail Service
FROM node:20-alpine AS base

# Install system dependencies
RUN apk add --no-cache \
    python3 \
    py3-pip \
    make \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    musl-dev \
    giflib-dev \
    pixman-dev \
    pangomm-dev \
    libjpeg-turbo-dev \
    freetype-dev

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY pnpm-lock.yaml* ./

# Install pnpm
RUN npm install -g pnpm

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build TypeScript
RUN pnpm build

# Production stage
FROM node:20-alpine AS runtime

# Install runtime dependencies
RUN apk add --no-cache \
    cairo \
    jpeg \
    pango \
    musl \
    giflib \
    pixman \
    pangomm \
    libjpeg-turbo \
    freetype

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S mailservice -u 1001

WORKDIR /app

# Copy built application
COPY --from=base --chown=mailservice:nodejs /app/dist ./dist
COPY --from=base --chown=mailservice:nodejs /app/node_modules ./node_modules
COPY --from=base --chown=mailservice:nodejs /app/package.json ./package.json

# Create directories for file processing
RUN mkdir -p /app/uploads /app/temp && \
    chown -R mailservice:nodejs /app

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3005

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').request({port:3005,path:'/health'}).end()"

# Switch to non-root user
USER mailservice

# Expose port
EXPOSE 3005

# Start the service
CMD ["node", "dist/index.js"]