FROM node:18-alpine

WORKDIR /app

# Install system dependencies
RUN apk add --no-cache curl

# Copy package files
COPY package*.json ./
COPY ../../packages/shared/package.json ../packages/shared/

# Install dependencies
RUN npm install

# Copy source code
COPY . .
COPY ../../packages/shared ../packages/shared

# Build TypeScript
RUN npm run build

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S signatureuser -u 1001

# Create necessary directories
RUN mkdir -p /app/uploads /app/logs && \
    chown -R signatureuser:nodejs /app

USER signatureuser

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3005/health || exit 1

EXPOSE 3005

CMD ["npm", "start"]