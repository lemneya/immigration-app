# Security Service Dockerfile
FROM node:18-alpine

# Install pnpm globally
RUN npm install -g pnpm@8

# Set working directory
WORKDIR /app

# Create security app directory
WORKDIR /app/apps/security

# Copy package files
COPY apps/security/package.json ./
COPY pnpm-workspace.yaml ../../
COPY pnpm-lock.yaml ../../

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy TypeScript configuration and source code
COPY apps/security/tsconfig.json ./
COPY apps/security/src ./src

# Create logs directory
RUN mkdir -p logs

# Build the application
RUN pnpm build

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S security -u 1001

# Change ownership of the app directory
RUN chown -R security:nodejs /app
USER security

# Expose the port
EXPOSE 3010

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').request({port:3010,path:'/health'}).end()" || exit 1

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3010
ENV HOST=0.0.0.0

# Start the service
CMD ["pnpm", "start"]